import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily } from '../theme/typography';

interface SearchablePickerModalProps {
  visible: boolean;
  title: string;
  items: string[];
  selectedItem?: string;
  onSelect: (item: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export const SearchablePickerModal: React.FC<SearchablePickerModalProps> = ({
  visible,
  title,
  items,
  selectedItem,
  onSelect,
  onClose,
  placeholder = 'Search...',
}) => {
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, search]);

  const handleSelect = (item: string) => {
    onSelect(item);
    setSearch('');
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeContainer}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                <Text style={styles.title}>{title}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={17} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = item === selectedItem;
                return (
                  <TouchableOpacity
                    style={[styles.itemRow, isSelected && styles.itemRowActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.itemText, isSelected && styles.itemTextActive]}>
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No matching options found</Text>
                </View>
              }
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  safeContainer: {
    maxHeight: '85%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 16,
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  itemRowActive: {
    backgroundColor: '#F0FDFA',
  },
  itemText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 14,
    color: '#334155',
  },
  itemTextActive: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 13,
    color: '#94A3B8',
  },
});
