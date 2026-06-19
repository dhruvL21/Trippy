import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_aZbUeVRjX',
      userPoolClientId: '3mis9f4oecir3ikk56fuun3vsf',
      signUpVerificationMethod: 'code',
    }
  }
})
