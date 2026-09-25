import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Visit, MedicineItem, ReminderItem } from '../types';

// Configure notification presentation in-app
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.log('Notification handler init notice:', e);
}

export const NotificationService = {
  /**
   * Configure Android Notification Channels
   */
  async initChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('medicine-reminders', {
          name: 'Medication Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
        });

        await Notifications.setNotificationChannelAsync('clinical-updates', {
          name: 'Clinical Care Plan Updates',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#0284C7',
          sound: 'default',
        });
      } catch (err) {
        console.warn('Channel configuration notice:', err);
      }
    }
  },

  /**
   * Request system notification permissions gracefully
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    try {
      await this.initChannels();
      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
        return true;
      }

      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL || false;
    } catch (err) {
      console.warn('Notification permission request notice:', err);
      return false;
    }
  },

  /**
   * Automatically schedule native recurring notifications for all prescribed medicines
   */
  async scheduleCarePlanReminders(visits: Visit[]): Promise<number> {
    if (Platform.OS === 'web') return 0;

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Notification permission not granted, skipping schedule');
        return 0;
      }

      // Clear existing scheduled medication notifications to prevent duplicates
      await Notifications.cancelAllScheduledNotificationsAsync();

      let scheduledCount = 0;
      // Use the latest active visit(s)
      const activeVisits = visits.slice(0, 2);

      for (const visit of activeVisits) {
        // 1. Process explicit reminder items if provided by doctor
        if (visit.reminders && visit.reminders.length > 0) {
          for (const rem of visit.reminders) {
            let hour = 8;
            let minute = 30;
            if (rem.time && rem.time.includes(':')) {
              const parts = (rem.time || '').split(':');
              hour = parseInt(parts[0], 10) || 8;
              minute = parseInt(parts[1], 10) || 30;
            }

            await Notifications.scheduleNotificationAsync({
              content: {
                title: `Dose Reminder: ${rem.medicine_name}`,
                body: `${rem.dosage} • ${rem.instructions || 'Take as advised by your doctor'}`,
                data: {
                  type: 'medicine_reminder',
                  medicine: rem.medicine_name,
                  dosage: rem.dosage,
                  visitId: visit.id,
                },
                sound: 'default',
              },
              trigger: {
                hour,
                minute,
                repeats: true,
                channelId: 'medicine-reminders',
              },
            });
            scheduledCount++;
          }
        } else if (visit.medicines && visit.medicines.length > 0) {
          // 2. Parse medicines and frequency patterns (e.g., 1-0-1, Morning & Night, TDS, etc.)
          for (const med of visit.medicines) {
            const freq = (med.frequency || '').toLowerCase();
            const slots: { slot: string; hour: number; minute: number }[] = [];

            if (freq.includes('1-1-1') || freq.includes('tds') || freq.includes('three')) {
              slots.push({ slot: 'Morning', hour: 8, minute: 30 });
              slots.push({ slot: 'Afternoon', hour: 13, minute: 30 });
              slots.push({ slot: 'Night', hour: 20, minute: 30 });
            } else if (freq.includes('1-0-1') || freq.includes('bd') || freq.includes('twice') || freq.includes('morning & night')) {
              slots.push({ slot: 'Morning', hour: 8, minute: 30 });
              slots.push({ slot: 'Night', hour: 20, minute: 30 });
            } else if (freq.includes('1-0-0') || freq.includes('od') || freq.includes('morning') || freq.includes('once')) {
              slots.push({ slot: 'Morning', hour: 8, minute: 30 });
            } else if (freq.includes('0-0-1') || freq.includes('night') || freq.includes('bedtime') || freq.includes('hs')) {
              slots.push({ slot: 'Night', hour: 20, minute: 30 });
            } else if (freq.includes('0-1-0') || freq.includes('afternoon')) {
              slots.push({ slot: 'Afternoon', hour: 13, minute: 30 });
            } else {
              // Default morning & night
              slots.push({ slot: 'Morning', hour: 8, minute: 30 });
              slots.push({ slot: 'Night', hour: 20, minute: 30 });
            }

              for (const s of slots) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `${s.slot} Dose: ${med.name}`,
                    body: `${med.dosage} (${med.instructions || 'Take with water'}) — Tap to mark as taken`,
                    data: {
                      type: 'medicine_reminder',
                      medicine: med.name,
                      dosage: med.dosage,
                      slot: s.slot,
                      visitId: visit.id,
                    },
                    sound: 'default',
                  },
                  trigger: {
                    hour: s.hour,
                    minute: s.minute,
                    repeats: true,
                    channelId: 'medicine-reminders',
                  },
                });
                scheduledCount++;
              }
            }
          }

          // 3. Schedule Day 3 & Day 7 Clinical Follow-Up Health Check-ins
          try {
            const rawDoc = visit.doctor_name || 'your physician';
            const docName = rawDoc.startsWith('Dr.') ? rawDoc : `Dr. ${rawDoc}`;
            const visitBaseDate = new Date(visit.approved_at || visit.date || Date.now());

            // Day 3 check-in trigger: 3 days after consultation at 10:00 AM
            const day3Target = new Date(visitBaseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
            day3Target.setHours(10, 0, 0, 0);

            if (day3Target.getTime() > Date.now()) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `🩺 Health Check-in: ${docName}`,
                  body: `Are you feeling good now after 3 days of your consultation with ${docName}? Tap to let us know how your health is.`,
                  data: {
                    type: 'health_checkin',
                    day: 3,
                    visitId: visit.id,
                    doctorName: docName,
                  },
                  sound: 'default',
                },
                trigger: {
                  date: day3Target,
                  channelId: 'clinical-updates',
                },
              });
              scheduledCount++;
            }

            // Day 7 check-in trigger: 7 days after consultation at 10:00 AM
            const day7Target = new Date(visitBaseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            day7Target.setHours(10, 0, 0, 0);

            if (day7Target.getTime() > Date.now()) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `🌱 7-Day Health Update: ${docName}`,
                  body: `It has been 7 days since your consultation with ${docName}. Is your health good now, or do you have any problems or wish to schedule another meeting with the doctor?`,
                  data: {
                    type: 'health_checkin',
                    day: 7,
                    visitId: visit.id,
                    doctorName: docName,
                  },
                  sound: 'default',
                },
                trigger: {
                  date: day7Target,
                  channelId: 'clinical-updates',
                },
              });
              scheduledCount++;
            }
          } catch (followupErr) {
            console.warn('Notice scheduling follow-up check-in notifications:', followupErr);
          }
        }

        await AsyncStorage.setItem('@praxirence_scheduled_reminders_count', scheduledCount.toString());
      return scheduledCount;
    } catch (err) {
      console.warn('Failed to schedule care plan reminders:', err);
      return 0;
    }
  },

  /**
   * Instant trigger for pilot evaluation (Fires within 2 seconds)
   */
  async triggerTestReminder(medName = 'Pantocid 40mg', dosage = '1 Tablet'): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await this.initChannels();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Medication Alarm: ${medName}`,
          body: `${dosage} (Before Breakfast) • Tap to confirm dose taken in Health Vault`,
          data: { test: true },
          sound: 'default',
        },
        trigger: {
          seconds: 2,
          channelId: 'medicine-reminders',
        },
      });
    } catch (e) {
      console.warn('Test alarm trigger notice:', e);
    }
  },
};
