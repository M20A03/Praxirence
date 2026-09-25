import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export interface SignedRequestHeaders {
  'X-Praxirence-Timestamp': string;
  'X-Praxirence-Nonce': string;
  'X-Praxirence-Signature': string;
  'X-Client-Platform': string;
  [key: string]: string;
}

/**
 * Hospital-Grade Network Security & Anti-Replay Interceptor (Doctor App)
 */
class NetworkSecurityInterceptor {
  private readonly REPLAY_WINDOW_MS = 300_000;

  async signRequest(
    method: string,
    endpoint: string,
    body?: string,
    authToken?: string
  ): Promise<SignedRequestHeaders> {
    const timestamp = Date.now().toString();
    const nonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${timestamp}-${Math.random()}-${endpoint}`
    );

    let bodyHash = '';
    if (body) {
      bodyHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        body
      );
    }

    const tokenPrefix = authToken ? authToken.substring(0, 16) : 'doctor_session';
    const payloadToSign = `${method.toUpperCase()}|${endpoint}|${timestamp}|${nonce}|${bodyHash}|${tokenPrefix}`;

    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      payloadToSign
    );

    return {
      'X-Praxirence-Timestamp': timestamp,
      'X-Praxirence-Nonce': nonce.substring(0, 32),
      'X-Praxirence-Signature': signature,
      'X-Client-Platform': `doctor-${Platform.OS}-${Platform.Version}`,
    };
  }

  validateResponseFreshness(responseTimestampHeader?: string | null): boolean {
    if (!responseTimestampHeader) return true;
    const serverTime = parseInt(responseTimestampHeader, 10);
    if (isNaN(serverTime)) return true;

    const diff = Math.abs(Date.now() - serverTime);
    return diff <= this.REPLAY_WINDOW_MS;
  }
}

export const NetworkSecurity = new NetworkSecurityInterceptor();
