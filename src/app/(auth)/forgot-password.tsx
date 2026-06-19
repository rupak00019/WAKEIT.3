import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleReset = async () => {
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'wakeit://reset-password',
      });
      if (resetErr) {
        setError(resetErr.message);
      } else {
        setSuccess(true);
        Animated.spring(successScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.bgBlob} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🔐</Text>
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a reset link</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <Animated.View
              style={[styles.successBox, { transform: [{ scale: successScale }] }]}
            >
              <Text style={styles.successEmoji}>📬</Text>
              <Text style={styles.successTitle}>Check Your Inbox</Text>
              <Text style={styles.successText}>
                We sent a password reset link to{'\n'}
                <Text style={styles.successEmail}>{email}</Text>
              </Text>
            </Animated.View>
          ) : (
            <>
              <Input
                label="Email Address"
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <Button
                title="Send Reset Email"
                onPress={handleReset}
                loading={loading}
                style={styles.resetBtn}
              />
            </>
          )}
        </Animated.View>

        {/* Back to Login */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <Link href="/(auth)/login" asChild>
            <Button title="← Back to Login" onPress={() => {}} variant="link" />
          </Link>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bgBlob: {
    position: 'absolute',
    width: width,
    height: 260,
    borderBottomLeftRadius: width * 0.5,
    borderBottomRightRadius: width * 0.5,
    backgroundColor: Colors.accent,
    opacity: 0.25,
    top: -80,
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h1,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: Spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.error,
    flex: 1,
  },
  resetBtn: {
    marginTop: Spacing.sm,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  successEmoji: {
    fontSize: 52,
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h2,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  successText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successEmail: {
    fontWeight: '600',
    color: Colors.dark,
  },
  footer: {
    alignItems: 'center',
  },
});
