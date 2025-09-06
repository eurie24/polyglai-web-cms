# Word Trainer Setup Guide

## Overview
The Word Trainer feature allows users to practice vocabulary through multiple-choice questions. Questions are stored in the Firestore database and fetched dynamically.

## Database Structure
Questions are stored in the `wordTrainer` collection with the following structure:

```javascript
{
  question: "What is the English word for 'hello'?",
  options: ["Hello", "Goodbye", "Thank you", "Please"],
  correctAnswer: "Hello",
  explanation: "Hello is the standard greeting in English.",
  pointsValue: 10,
  languageId: "english",  // lowercase language code
  level: "beginner"       // lowercase level
}
```

## Adding Questions

### Method 1: Using the Script (Recommended)
1. Make sure you have the `serviceAccountKey.json` file in the project root
2. Run the script to add sample questions:
   ```bash
   node scripts/add-word-trainer-questions.js
   ```

### Method 2: Manual Addition via Firebase Console
1. Go to Firebase Console → Firestore Database
2. Navigate to the `wordTrainer` collection
3. Add a new document with the structure above

### Method 3: Programmatic Addition
You can add questions programmatically using the Firebase Admin SDK:

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

const question = {
  question: "Your question here?",
  options: ["Option A", "Option B", "Option C", "Option D"],
  correctAnswer: "Option A",
  explanation: "Explanation of the answer",
  pointsValue: 10,
  languageId: "english",
  level: "beginner"
};

await db.collection('wordTrainer').add(question);
```

## Supported Languages and Levels

### Languages
- `english` - English
- `spanish` - Spanish
- `mandarin` - Mandarin Chinese
- `japanese` - Japanese
- `korean` - Korean

### Levels
- `beginner` - Basic vocabulary
- `intermediate` - Intermediate vocabulary
- `advanced` - Advanced vocabulary (currently only for English)

## Question Guidelines

### Best Practices
1. **Clear Questions**: Make questions clear and unambiguous
2. **Balanced Options**: All options should be plausible but only one correct
3. **Helpful Explanations**: Provide explanations that help users learn
4. **Appropriate Difficulty**: Match question difficulty to the level
5. **Cultural Sensitivity**: Consider cultural context for different languages

### Question Types
- **Translation**: "What is the [language] word for [English word]?"
- **Definition**: "What does [word] mean?"
- **Context**: "Which word would you use in [situation]?"

### Points System
- Each question awards 10 points by default
- Points are added to the user's language progress
- Users earn points for correct answers

## Testing Questions

After adding questions:
1. Start the development server: `npm run dev`
2. Navigate to the user dashboard
3. Click "Go" in the Word Trainer section
4. Test the questions for your language and level

## Troubleshooting

### No Questions Appearing
- Check that questions exist in the `wordTrainer` collection
- Verify `languageId` and `level` match exactly (lowercase)
- Check browser console for any errors

### Questions Not Loading
- Verify Firebase configuration
- Check network connectivity
- Ensure user is authenticated

### Points Not Saving
- Check user authentication
- Verify Firestore permissions
- Check browser console for errors

## Example Questions

### English Beginner
```javascript
{
  question: "What is the English word for 'hello'?",
  options: ["Hello", "Goodbye", "Thank you", "Please"],
  correctAnswer: "Hello",
  explanation: "Hello is the standard greeting in English.",
  pointsValue: 10,
  languageId: "english",
  level: "beginner"
}
```

### Spanish Intermediate
```javascript
{
  question: "¿Qué significa 'entender'?",
  options: ["Saber", "Entender", "Pensar", "Creer"],
  correctAnswer: "Entender",
  explanation: "Entender significa comprender o captar el significado.",
  pointsValue: 10,
  languageId: "spanish",
  level: "intermediate"
}
```

## Security Rules
Make sure your Firestore security rules allow reading from the `wordTrainer` collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wordTrainer/{document} {
      allow read: if request.auth != null;
    }
  }
}
```
