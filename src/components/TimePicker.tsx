import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Button } from './ui/Button';
import { Colors, Typography, Spacing } from '../constants/theme';

type TimePickerProps = {
  value: Date;
  onChange: (time: Date) => void;
  label?: string;
};

/**
 * Cross-platform time picker
 * Web: uses native HTML <input type="time">
 * Mobile: uses @react-native-community/datetimepicker
 */
export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [showNativePicker, setShowNativePicker] = useState(false);

  const formattedTime = value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (Platform.OS === 'web') {
    // Web: use native HTML time input
    const hours = value.getHours().toString().padStart(2, '0');
    const minutes = value.getMinutes().toString().padStart(2, '0');
    const timeValue = `${hours}:${minutes}`;

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <input
          type="time"
          value={timeValue}
          onChange={(e: any) => {
            const [h, m] = e.target.value.split(':').map(Number);
            const newTime = new Date();
            newTime.setHours(h, m, 0, 0);
            onChange(newTime);
          }}
          style={{
            fontSize: 16,
            padding: '12px 16px',
            borderRadius: 8,
            border: `1px solid ${Colors.border}`,
            backgroundColor: '#fff',
            color: Colors.text,
            width: '100%',
            boxSizing: 'border-box' as any,
          }}
        />
      </View>
    );
  }

  // Mobile: use native picker
  const DateTimePicker = require('@react-native-community/datetimepicker').default;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Button
        title={formattedTime}
        variant="outline"
        onPress={() => setShowNativePicker(true)}
      />
      {showNativePicker && (
        <DateTimePicker
          value={value}
          mode="time"
          display="spinner"
          onChange={(event: any, selectedTime?: Date) => {
            setShowNativePicker(Platform.OS === 'ios');
            if (selectedTime) {
              onChange(selectedTime);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
});
