import { Amplify } from 'aws-amplify'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'ap-south-1_aZbUeVRjX';
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '3mis9f4oecir3ikk56fuun3vsf';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_aZbUeVRjX',
      userPoolClientId: '3mis9f4oecir3ikk56fuun3vsf',
      signUpVerificationMethod: 'code',
    }
  }
})
