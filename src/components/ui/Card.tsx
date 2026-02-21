import React from 'react';
import { View, ViewProps } from 'react-native';
import { CommonStyles } from '../../constants/theme';

export function Card({ style, children, ...props }: ViewProps) {
  return (
    <View style={[CommonStyles.card, style]} {...props}>
      {children}
    </View>
  );
}
