# Data Export Feature

## Overview
The admin dashboard now includes a comprehensive data export feature that allows administrators to export user data to Excel (.xlsx) or CSV formats while ensuring user privacy by excluding email addresses and other sensitive information.

## Features

### 🔒 Privacy Protection
- **No Email Addresses**: User email addresses are completely excluded from all exports
- **Sanitized Data**: Only safe, non-sensitive user information is included
- **Admin Filtering**: Admin users are automatically excluded from exports

### 📊 Export Formats
- **Excel (.xlsx)**: Multi-sheet workbook with comprehensive data
- **CSV**: Simple comma-separated values for easy import into other tools

### 📋 Data Included
The export includes the following user information:
- User ID
- Name
- Role
- Gender
- Age
- Location
- Profession
- Created At
- Last Login
- Preferred Language
- Referral Source
- Status
- Total Languages
- Total Assessments
- Total Points

### 📈 Excel Export Structure
The Excel export includes three sheets:

1. **Users Sheet**: Main user data with progress summaries
2. **Language Progress Sheet**: Detailed language learning progress per user
3. **Summary Sheet**: Statistical overview and analytics

## Usage

### From Dashboard
1. Navigate to the main dashboard (`/dashboard`)
2. Click either "Export Excel" or "Export CSV" button
3. The file will automatically download

### From User Management
1. Navigate to User Management (`/dashboard/users`)
2. Click either "Export Excel" or "Export CSV" button in the header
3. The file will automatically download

## API Endpoint

### GET `/api/export-data`

**Parameters:**
- `format`: `excel` or `csv` (default: `excel`)
- `type`: `users` (default: `users`)

**Example:**
```
GET /api/export-data?format=csv&type=users
GET /api/export-data?format=excel&type=users
```

**Response:**
- **CSV**: Returns CSV data with appropriate headers
- **Excel**: Returns Excel file (.xlsx) with multiple sheets

## Security Features

### Data Sanitization
The export process includes multiple layers of data sanitization:

1. **Email Removal**: All email addresses are stripped from the data
2. **Admin Filtering**: Users with admin emails are excluded
3. **Sensitive Data Removal**: Photo URLs, avatar URLs, and other sensitive fields are removed
4. **Data Validation**: Only safe, non-personal data is included

### Privacy Compliance
- No personally identifiable information (PII) in exports
- User IDs are included for reference but are not personally identifiable
- All data is aggregated and anonymized where possible

## Technical Implementation

### Backend (API Route)
- Uses Firebase Admin SDK for secure data access
- Implements comprehensive data sanitization
- Supports both CSV and Excel generation using `xlsx` library
- Includes progress calculation and statistical analysis

### Frontend (UI Components)
- Export buttons integrated into dashboard and user management pages
- Automatic file download with proper naming
- Error handling and user feedback
- Responsive design matching existing UI theme

### Data Processing
- Real-time calculation of user progress metrics
- Language-specific assessment counting
- Statistical aggregation for summary reports
- Date formatting and normalization

## File Naming Convention
Exported files follow this naming pattern:
- `polyglai_users_YYYY-MM-DD.xlsx` (Excel)
- `polyglai_users_YYYY-MM-DD.csv` (CSV)

## Error Handling
- Network errors are caught and displayed to users
- Invalid format requests return appropriate error responses
- Database access errors are logged and handled gracefully
- User-friendly error messages for common issues

## Future Enhancements
- Additional export formats (JSON, XML)
- Custom date range filtering
- Advanced filtering options
- Scheduled exports
- Email delivery of exports
- Data visualization in exports

## Testing
To test the export functionality:

1. Start the development server: `npm run dev`
2. Navigate to the admin dashboard
3. Click the export buttons
4. Verify files download correctly
5. Check that no email addresses are present in the exported data

## Dependencies
- `xlsx`: For Excel file generation
- `firebase-admin`: For secure database access
- `next`: For API route handling

## Security Considerations
- All exports are generated server-side for security
- No client-side data processing to prevent data leaks
- Proper authentication required for access
- Data sanitization happens before any file generation
- Admin-only access to export functionality
