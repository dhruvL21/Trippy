import { getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth';
import type { User } from '../types';

export async function logoutCognito() {
  await signOut();
}

export async function checkCognitoSession(): Promise<User | null> {
  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.payload;
    if (idToken) {
      return {
        id: 'c-' + user.userId,
        name: (idToken.name as string) || (idToken.given_name as string) || (idToken.email as string)?.split('@')[0] || user.username || 'User',
        email: (idToken.email as string) || '',
        authProvider: 'cognito'
      };
    }
    return null;
  } catch {
    return null;
  }
}
