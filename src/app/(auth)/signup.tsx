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
  Image,
  Pressable,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { User, Mail, Lock } from 'lucide-react-native';

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Background Skyline */}
        <Image 
          source={require('../../assets/images/illustrations/skyline.png')}
          style={styles.skyline}
          resizeMode="cover"
        />

        {/* Top Header Section */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoTextDark}>WAKE</Text>
            <Text style={styles.logoTextPrimary}>IT</Text>
          </View>
          
          <Text style={styles.tagline}>Wake together. Achieve together.</Text>
        </Animated.View>

        {/* Form Section */}
        <Animated.View
          style={[
            styles.formContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start waking up with your group.</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Input
              label="Full Name"
              placeholder="John Doe"
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
              leftIcon={<User size={20} color={Colors.textSecondary} />}
            />
          </View>

          <View style={styles.inputGroup}>
            <Input
              label="Email"
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              leftIcon={<Mail size={20} color={Colors.textSecondary} />}
            />
          </View>

          <View style={styles.inputGroup}>
            <Input
              label="Password"
              placeholder="Create a strong password"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              leftIcon={<Lock size={20} color={Colors.textSecondary} />}
            />
          </View>

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
            <Pressable>
              <Text style={styles.loginText}>Log in</Text>
            </Pressable>
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
    backgroundColor: Colors.surface,
  },
  skyline: {
    position: 'absolute',
    top: 0,
    width: width,
    height: 180,
    opacity: 0.5,
    zIndex: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    zIndex: 1,
  },
  logoTextContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  logoTextDark: {
    fontFamily: Typography.fonts.bold,
    fontSize: 32,
    color: Colors.dark,
    letterSpacing: 2,
  },
  logoTextPrimary: {
    fontFamily: Typography.fonts.bold,
    fontSize: 32,
    color: Colors.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
  },
  formContainer: {
    paddingHorizontal: Spacing.xl,
    zIndex: 1,
  },
  title: {
    fontFamily: Typography.fonts.bold,
    fontSize: 24,
    color: Colors.dark,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
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
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  hint: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: -4,
    marginBottom: Spacing.lg,
    marginLeft: 4,
  },
  signUpBtn: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    marginBottom: Spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: Spacing.lg,
  },
  footerText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  loginText: {
    fontFamily: Typography.fonts.medium,
    fontSize: Typography.sizes.caption,
    color: Colors.primary,
  },
  termsRow: {
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
