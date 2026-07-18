import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Colors, Typography, BorderRadius } from '../../constants/theme';

type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { theme } = useTheme();

  const dynamicStyle =
    variant === 'primary'
      ? { backgroundColor: theme.primary }
      : variant === 'outline'
      ? { borderColor: theme.primary }
      : {};

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        dynamicStyle,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? theme.primary : '#fff'}
        />
      ) : (
        <Text style={[
          styles.text,
          styles[`${variant}Text`],
          variant === 'outline' && { color: theme.primary },
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    // backgroundColor set dynamically
  },
  secondary: {
    backgroundColor: Colors.textSecondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    // borderColor set dynamically
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...Typography.button,
    color: '#fff',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#fff',
  },
  outlineText: {
    // color set dynamically
  },
});
