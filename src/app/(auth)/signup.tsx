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

export default function SignUp() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { error: profileError } = await supabase
          .from('users')
          .update({ full_name: fullName })
          .eq('id', data.user.id);

        if (profileError) {
          console.warn('Could not update user full name:', profileError.message);
        }
        router.replace('/(auth)/plans');
      } else {
        setError('Signup complete. Please check your email to confirm registration.');
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

      {/* Decorative blobs */}
      <View style={styles.topBlob} />
      <View style={styles.topBlobAccent} />

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
          <View style={styles.logoMark}>
            <Text style={styles.logoIcon}>🚀</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start waking up with your group</Text>
        </Animated.View>

        {/* Form card */}
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

          <Input
            label="Full Name"
            placeholder="John Doe"
            autoCapitalize="words"
            value={fullName}
            onChangeText={setFullName}
          />
          <Input
            label="Email Address"
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="Create a strong password"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {/* Password strength hint */}
          <Text style={styles.hint}>Use at least 8 characters with letters and numbers</Text>

          <Button
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            style={styles.signUpBtn}
          />
        </Animated.View>

        {/* Footer */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Button title="Log In" onPress={() => {}} variant="link" style={styles.linkInline} />
          </Link>
        </Animated.View>

        {/* Terms notice */}
        <Animated.View style={[styles.termsRow, { opacity: fadeAnim }]}>
          <Text style={styles.termsText}>
            By signing up you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
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
  topBlob: {
    position: 'absolute',
    width: width * 1.4,
    height: 280,
    borderBottomLeftRadius: width * 0.7,
    borderBottomRightRadius: width * 0.7,
    backgroundColor: Colors.primary,
    opacity: 0.08,
    top: -80,
    alignSelf: 'center',
  },
  topBlobAccent: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    opacity: 0.6,
    top: -20,
    left: 20,
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
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  logoIcon: {
    fontSize: 32,
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
  hint: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: -2,
    marginBottom: Spacing.sm,
  },
  signUpBtn: {
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  linkInline: {
    padding: 0,
    marginVertical: 0,
    minHeight: 0,
    height: 'auto',
  },
  termsRow: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  termsText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textDisabled,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
