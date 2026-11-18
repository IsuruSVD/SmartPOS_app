import React, { useEffect, useState, createContext, useContext } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { DatabaseService } from '../src/db/services/DatabaseService';

export const DbContext = createContext<DatabaseService | null>(null);

/** Convenience hook — throws if used outside DbContext.Provider. */
export function useDb(): DatabaseService {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDb must be used inside DbContext.Provider');
  return ctx;
}

/**
 * Root layout — initialises the SQLite database before rendering any screen.
 *
 * React Strict Mode calls useEffect twice in development, which would normally
 * trigger two init() calls. DatabaseService.init() is promise-memoised so the
 * second call receives the same in-flight Promise and the same instance.
 */
export default function RootLayout() {
  const [db,    setDb]    = useState<DatabaseService | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    DatabaseService.init()
      .then((instance) => { if (!cancelled) setDb(instance); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    // Cleanup: mark cancelled so a Strict Mode second-pass doesn't double-set state.
    // The DB itself is not closed — DatabaseService is a singleton.
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Database initialisation failed:{'\n'}{error}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.sub}>Starting database…</Text>
      </View>
    );
  }

  return (
    <DbContext.Provider value={db}>
      <Slot />
    </DbContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  error:  { color: '#c0392b', textAlign: 'center', fontSize: 14 },
  sub:    { fontSize: 13, color: '#888' },
});
