import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface FAQ {
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    question: 'How does group accountability work?',
    answer: 'Alarms are set for the whole group. When the alarm triggers, everyone must complete the math challenge to turn it off. Real-time updates show who has woken up and who is still sleeping.',
  },
  {
    question: 'What happens if I lose internet connection overnight?',
    answer: 'No worries! WAKEIT saves your group alarms locally in SQLite. The alarm is guaranteed to ring even without an active internet connection. Your completed challenge status will sync back as soon as you are back online.',
  },
  {
    question: 'How is my Wake Score calculated?',
    answer: 'Your Wake Score is the percentage of alarms you have completed successfully before timing out (5 minutes). High completion rates keep your score close to 100%.',
  },
  {
    question: 'Can I snooze the alarm?',
    answer: 'No! There is no snooze button in WAKEIT. The only way to stop the alarm sound is by solving the math challenge.',
  },
  {
    question: 'How do I add members to my group?',
    answer: 'Every group has a unique 6-character Invite Code. Copy this code from the Group Dashboard and share it with your friends. They can join by entering this code on the "Join Group" screen.',
  },
  {
    question: 'How do I cancel or delete an alarm?',
    answer: 'Only group Admins can delete or edit scheduled alarms. Go to the Alarm Details screen, click "Delete Alarm" or "Edit Alarm" to modify it.',
  },
];

export default function HelpAndSupport() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(index);
    }
  };

  const handleContact = () => {
    Alert.alert('Contact Support', 'Email us at support@wakeit.app. We typically respond within 24 hours.');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>Frequently Asked Questions</Text>

      {FAQS.map((faq, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <Pressable key={index} onPress={() => toggleFAQ(index)}>
            <Card style={styles.faqCard}>
              <View style={styles.questionRow}>
                <Text style={styles.question}>{faq.question}</Text>
                <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
              </View>
              {isExpanded && (
                <Text style={styles.answer}>{faq.answer}</Text>
              )}
            </Card>
          </Pressable>
        );
      })}

      <Card style={styles.contactCard}>
        <Text style={styles.contactTitle}>Still need help?</Text>
        <Text style={styles.contactText}>If your question is not answered above, please contact our support team.</Text>
        <Button title="Contact Support" onPress={handleContact} />
      </Card>

      <Text style={styles.versionText}>WAKEIT App Version 1.0.0 (Build 56)</Text>

      <Button title="Go Back" onPress={() => router.back()} variant="secondary" style={styles.backBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#013237',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  faqCard: {
    marginVertical: 4,
    padding: 12,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  question: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#013237',
    flex: 1,
    marginRight: 12,
  },
  chevron: {
    fontSize: 12,
    color: '#6B7280',
  },
  answer: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  contactCard: {
    marginVertical: 16,
    padding: 16,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  versionText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 12,
  },
  backBtn: {
    marginVertical: 16,
    marginBottom: 48,
  },
});
