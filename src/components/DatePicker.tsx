import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Button } from './ui/Button';
import { Colors, Typography, Spacing } from '../constants/theme';
import { format } from 'date-fns';

type DatePickerProps = {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  minimumDate?: Date;
};

export function DatePicker({ value, onChange, label, minimumDate }: DatePickerProps) {
  const [showNativePicker, setShowNativePicker] = useState(false);

  const formattedDate = format(value, 'MMMM d, yyyy');

  if (Platform.OS === 'web') {
    const dateValue = format(value, 'yyyy-MM-dd');
    const minValue = minimumDate ? format(minimumDate, 'yyyy-MM-dd') : undefined;

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <input
          type="date"
          value={dateValue}
          min={minValue}
          onChange={(e: any) => {
            const [y, m, d] = e.target.value.split('-').map(Number);
            const newDate = new Date(y, m - 1, d);
            onChange(newDate);
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
        title={formattedDate}
        variant="outline"
        onPress={() => setShowNativePicker(true)}
      />
      {showNativePicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={(_event: any, selectedDate?: Date) => {
            setShowNativePicker(Platform.OS === 'ios');
            if (selectedDate) {
              onChange(selectedDate);
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
