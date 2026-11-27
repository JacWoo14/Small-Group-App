import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CreateGroupScreen from '../screens/plans/CreateGroupScreen';

const plans = [
  { id: 'old', name: 'Bible Reading', total_days: 292 },
  { id: 'new', name: 'Whole Bible, 1 a day', total_days: 1221 },
];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { isPersonal: true, preselectedPlanId: 'new' } }),
}));
jest.mock('../hooks/useGroups', () => ({
  useAvailablePlans: () => ({ data: plans, isLoading: false }),
  useCreateGroup: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: { primary: '#000', selectedBackground: '#fff' } }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

describe('CreateGroupScreen with a preselected plan', () => {
  it('shows only that plan until another is asked for', async () => {
    const screen = await render(<CreateGroupScreen />);

    expect(screen.getByText('Whole Bible, 1 a day')).toBeTruthy();
    expect(screen.queryByText('Bible Reading')).toBeNull();

    await fireEvent.press(screen.getByText('Choose a different plan'));
    expect(screen.getByText('Bible Reading')).toBeTruthy();
  });
});
