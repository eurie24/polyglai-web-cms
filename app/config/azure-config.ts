// Azure Configuration File
// Update these values with your actual Azure credentials

export const azureConfig = {
  // Azure Speech Service
  speech: {
    subscriptionKey: process.env.NEXT_PUBLIC_AZURE_SPEECH_SUBSCRIPTION_KEY || 'your_azure_speech_subscription_key_here',
    region: process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION || 'southeastasia',
    endpoint: process.env.NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT || 'https://southeastasia.api.cognitive.microsoft.com',
  },
  
  // Azure Translator Service
  translator: {
    subscriptionKey: process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY || 'your_azure_translator_subscription_key_here',
    region: process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_REGION || 'southeastasia',
    endpoint: process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com',
  },
  
  // Alternative endpoints to try if main ones fail
  // Using current Azure Cognitive Services endpoints
  alternativeEndpoints: [
    'https://southeastasia.stt.speech.microsoft.com',
    'https://southeastasia.api.cognitive.microsoft.com',
    'https://southeastasia.cognitiveservices.azure.com'
  ]
};

// Helper function to check if configuration is complete
export const isAzureConfigured = () => {
  const speech = azureConfig.speech;
  return speech.subscriptionKey && 
         speech.subscriptionKey !== 'your_azure_speech_subscription_key_here' &&
         speech.subscriptionKey.length > 32 &&
         speech.region &&
         speech.endpoint;
};

// Helper function to get configuration status
export const getAzureConfigStatus = () => {
  return {
    speech: {
      configured: azureConfig.speech.subscriptionKey !== 'your_azure_speech_subscription_key_here',
      subscriptionKey: azureConfig.speech.subscriptionKey ? 
        `${azureConfig.speech.subscriptionKey.substring(0, 8)}...${azureConfig.speech.subscriptionKey.substring(azureConfig.speech.subscriptionKey.length - 4)}` : 
        'Not configured',
      region: azureConfig.speech.region,
      endpoint: azureConfig.speech.endpoint
    },
    translator: {
      configured: azureConfig.translator.subscriptionKey !== 'your_azure_translator_subscription_key_here',
      subscriptionKey: azureConfig.translator.subscriptionKey ? 
        `${azureConfig.translator.subscriptionKey.substring(0, 8)}...${azureConfig.translator.subscriptionKey.substring(azureConfig.translator.subscriptionKey.length - 4)}` : 
        'Not configured',
      region: azureConfig.translator.region,
      endpoint: azureConfig.translator.endpoint
    }
  };
};
