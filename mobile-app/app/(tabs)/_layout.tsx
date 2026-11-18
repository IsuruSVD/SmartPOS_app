import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '../../src/ui/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="pos"
        options={{
          title: 'POS',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🛒</Text>,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🧾</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 20,
  },
});
