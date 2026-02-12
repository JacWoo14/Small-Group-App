# Bible Accountability App

A mobile application for daily Bible reading with group accountability, progress tracking, and smart notifications. Built with React Native and Expo.

## 🌟 Features

### Core Features (Migrated from Web App)
- 📖 **Multiple Reading Plans** - Pre-built and custom plans
- 🔥 **Streak Tracking** - Build motivation with daily streaks
- ✅ **Progress Tracking** - Visual progress and completion percentages
- 📝 **Personal Notes** - Add reflections for each reading
- 🏷️ **Study Focus Tags** - Track themes and topics

### New Mobile Features
- 👥 **Group Accountability** - Join reading groups and see each other's progress
- 🔔 **Smart Notifications** - Daily reminders with mark-complete from notification
- 🔐 **User Accounts** - Secure authentication with social login
- 📥 **Plan Import** - Import from JSON, CSV, YouVersion, Bible Gateway
- 📱 **Native Mobile** - Optimized for iOS and Android

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- Expo Go app on your phone (for testing)
- Git

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Run on your device**:
   - Scan the QR code with Expo Go (Android)
   - Scan with Camera app (iOS) and open in Expo Go

4. **Run on simulator/emulator**:
   ```bash
   npm run ios     # iOS Simulator (macOS only)
   npm run android # Android Emulator
   ```

## 📁 Project Structure

```
bible-accountability-app/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components
│   ├── navigation/       # Navigation configuration
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   │   ├── dateUtils.ts      # Date calculations and formatting
│   │   ├── readingPlans.ts   # Reading plan management
│   │   ├── customPlans.ts    # Custom plan creation
│   │   └── storage.ts        # AsyncStorage wrapper
│   ├── data/             # Static data (plans, tags)
│   ├── services/         # API services (groups, auth, notifications)
│   ├── hooks/            # Custom React hooks
│   └── constants/        # Theme, colors, constants
│       └── theme.ts          # Design system
├── assets/               # Images, fonts, etc.
├── App.tsx              # App entry point
├── MIGRATION_PLAN.md    # Migration guide from web app
├── ARCHITECTURE.md      # Technical architecture docs
└── README.md            # This file
```

## 🎨 Design System

The app uses a warm, peaceful aesthetic inspired by sacred texts:

**Colors**:
- Sacred Gold: `#C4941D`
- Deep Earth: `#5A4A3B`
- Spiritual Blue: `#4A5F7F`
- Parchment Background: `#F5F1E8`

**Typography**:
- Headings: Bold, Deep Earth color
- Body: Regular, readable spacing
- UI: Medium weight for buttons and labels

All design tokens are defined in [`src/constants/theme.ts`](src/constants/theme.ts).

## 🔧 Tech Stack

### Frontend
- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **React Navigation** - Navigation library

### State & Storage
- **React Context** - State management (initially)
- **AsyncStorage** - Local data persistence
- **date-fns** - Date utilities

### Backend (To Be Implemented)
- **Supabase** - Database, auth, real-time
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Edge functions

### Notifications
- **Expo Notifications** - Push notifications
- **Expo Background Fetch** - Background updates

## 📊 Migration Status

### ✅ Completed
- [x] Project setup with Expo
- [x] TypeScript types and interfaces
- [x] Utility functions (date, storage, plans)
- [x] Theme and design system
- [x] Navigation structure
- [x] Placeholder screens

### 🔄 In Progress
- [ ] Migrate React components from web app
- [ ] Implement core screens

### ⏳ Pending
- [ ] User authentication
- [ ] Group functionality
- [ ] Push notifications
- [ ] Plan import/export
- [ ] Backend integration

See [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for detailed migration roadmap.

## 🏗️ Architecture

The app follows an offline-first architecture:

1. **Local Storage**: AsyncStorage for immediate data access
2. **Sync Queue**: Changes queued for backend sync
3. **Real-time Updates**: Supabase subscriptions for group updates
4. **Optimistic UI**: UI updates immediately, syncs in background

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete technical documentation.

## 📱 Screens

### Today (Home)
- View today's reading passage
- Mark reading as complete
- See current streak
- View group members' completion status
- Add personal notes

### Plans
- Browse available reading plans
- View plan details
- Create custom plans
- Import plans from various sources

### Groups (NEW)
- View your accountability groups
- Create or join groups
- See group progress dashboard
- View member activity

### Progress
- Current and longest streak
- Total readings completed
- Completion percentage
- Reading history
- Milestone achievements

### Settings
- User profile
- Notification preferences
- Daily reminder time
- Import/Export data
- Reset progress

## 🔔 Notifications

### Daily Reading Reminder
- Scheduled at user's preferred time
- Shows today's passages
- Quick action to mark as complete

### Group Updates
- Member completed reading
- New member joined
- Group milestone reached

### Encouragement
- Streak milestones (7, 14, 30, 90 days)
- Weekly progress summary
- Motivational messages

## 👥 Group Features

### Create Groups
- Set group name and description
- Choose reading plan for group
- Generate invite code

### Join Groups
- Enter invite code
- View group before joining
- Multiple groups supported

### Group Progress
- See who completed today
- View member streaks
- Group completion rate
- Member activity feed

## 📥 Plan Import

### Supported Formats
- **JSON**: Native format
- **CSV**: Custom format
- **YouVersion**: Import from YouVersion plans
- **Bible Gateway**: Import from Bible Gateway

### Import Methods
- File picker (local files)
- URL import (online plans)
- Manual entry

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run with coverage
npm run test:coverage

# E2E tests (when implemented)
npm run test:e2e
```

## 🚢 Deployment

### Preview Build (for testing)
```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

### Production Build
```bash
eas build --profile production --platform all
```

### Over-the-Air Updates
```bash
eas update --branch production
```

## 📝 Development

### Code Style
- Use TypeScript for all new code
- Follow existing file structure
- Document complex functions
- Use theme constants for styling

### Commit Messages
```
feat: Add group creation screen
fix: Resolve streak calculation bug
docs: Update README with API info
refactor: Simplify storage utils
```

### Pull Requests
- Create feature branches
- Write descriptive PR descriptions
- Ensure all tests pass
- Update documentation if needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Original web app design and concept
- Bible reading plans from various sources
- Expo and React Native communities

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase Docs](https://supabase.com/docs)
- [React Native Docs](https://reactnative.dev/)

## 🐛 Known Issues

- [ ] Navigation not yet fully implemented
- [ ] Backend integration pending
- [ ] Notifications not configured

See GitHub Issues for full list.

## 📞 Support

For questions or issues:
1. Check existing documentation
2. Search closed issues
3. Create a new issue with details

---

**Built with ❤️ for consistent Bible reading and accountability**
