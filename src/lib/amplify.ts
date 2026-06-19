import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_aZbUeVRjX',
      userPoolClientId: '1qj64pfbco37mqg1eln9pmamqb',
      signUpVerificationMethod: 'code',
    }
  }
})
