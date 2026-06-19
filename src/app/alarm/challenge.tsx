import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Vibration, BackHandler, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAlarmStore } from '@/store/alarmStore';
import { insertOfflineCompletion } from '@/lib/sqlite';
import Button from '@/components/ui/Button';
import { startAlarmSoundAndVibration, stopAlarmSoundAndVibration } from '@/lib/alarmSound';

function generateChallenge(diff: 'easy' | 'medium' | 'hard') {
  let question = '';
  let answer = 0;
  
  if (diff === 'easy') {
    // Single-digit addition or subtraction
    const num1 = Math.floor(Math.random() * 9) + 1; // 1-9
    const num2 = Math.floor(Math.random() * 9) + 1; // 1-9
    const isAddition = Math.random() > 0.5;
    
    if (isAddition) {
      question = `${num1} + ${num2}`;
      answer = num1 + num2;
    } else {
      const large = Math.max(num1, num2);
      const small = Math.min(num1, num2);
      const actualSmall = large === small ? (small > 1 ? small - 1 : 1) : small;
      const actualLarge = large === actualSmall ? large + 1 : large;
      question = `${actualLarge} - ${actualSmall}`;
      answer = actualLarge - actualSmall;
    }
  } else if (diff === 'medium') {
    // Two-digit multiplication: one 2-digit (10-20), one 1-digit (2-9)
    const isNum1TwoDigit = Math.random() > 0.5;
    const num1 = isNum1TwoDigit 
      ? Math.floor(Math.random() * 11) + 10  // 10-20
      : Math.floor(Math.random() * 8) + 2;   // 2-9
    const num2 = isNum1TwoDigit
      ? Math.floor(Math.random() * 8) + 2    // 2-9
      : Math.floor(Math.random() * 11) + 10; // 10-20
      
    question = `${num1} * ${num2}`;
    answer = num1 * num2;
  } else {
    // Hard: multi-step equations
    const type = Math.floor(Math.random() * 3);
    if (type === 0) {
      const num1 = Math.floor(Math.random() * 10) + 3; // 3-12
      const num2 = Math.floor(Math.random() * 8) + 3;  // 3-10
      const product = num1 * num2;
      const num3 = Math.floor(Math.random() * (product - 5)) + 1;
      question = `(${num1} * ${num2}) - ${num3}`;
      answer = product - num3;
    } else if (type === 1) {
      const num1 = Math.floor(Math.random() * 5) + 2; // 2-6
      const num2 = Math.floor(Math.random() * 8) + 2; // 2-9
      const num3 = Math.floor(Math.random() * 8) + 2; // 2-9
      question = `${num1} * (${num2} + ${num3})`;
      answer = num1 * (num2 + num3);
    } else {
      const num1 = Math.floor(Math.random() * 8) + 2; // 2-9
      const num2 = Math.floor(Math.random() * 8) + 2; // 2-9
      const num3 = Math.floor(Math.random() * 5) + 2; // 2-6
      const product = (num1 + num2) * num3;
      const num4 = Math.floor(Math.random() * (product - 5)) + 1;
      question = `(${num1} + ${num2}) * ${num3} - ${num4}`;
      answer = product - num4;
    }
  }
  return { question, answer: answer.toString() };
}

export default function MathChallenge() {
  const router = useRouter();
  const { alarmId, alarmTitle, groupName, difficulty: paramDifficulty, alarmTime } = useLocalSearchParams<{
    alarmId: string;
    alarmTitle: string;
    groupName: string;
    difficulty: 'easy' | 'medium' | 'hard';
    alarmTime: string;
  }>();

  const { completeChallenge } = useAlarmStore();

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [questionText, setQuestionText] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [submitting, setSubmitting] = useState(false);

  // Initialize challenge and enable continuous ring
  useEffect(() => {
    const diffVal = paramDifficulty || 'easy';
    setDifficulty(diffVal);
    const { question, answer } = generateChallenge(diffVal);
    setQuestionText(question);
    setCorrectAnswer(answer);

    // Continuous audio/vibrations should continue playing
    startAlarmSoundAndVibration();

    // Disable Android back button
    const backAction = () => true;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      backHandler.remove();
    };
  }, [paramDifficulty]);

  // 5 Minute Countdown Timer from original alarm time
  useEffect(() => {
    const alarmTimeParsed = alarmTime ? new Date(alarmTime).getTime() : Date.now();

    const checkTimeout = () => {
      const elapsedMs = Date.now() - alarmTimeParsed;
      const remainingSec = Math.max(0, Math.floor((300000 - elapsedMs) / 1000));
      setTimeLeft(remainingSec);

      if (elapsedMs >= 300000) {
        clearInterval(timer);
        handleTimeout();
      }
    };

    checkTimeout();
    const timer = setInterval(checkTimeout, 1000);
    return () => clearInterval(timer);
  }, [alarmTime]);

  const handleTimeout = async () => {
    setSubmitting(true);
    await stopAlarmSoundAndVibration(); // Stop alarm sound & vibration

    const alarm_id = alarmId || 'unknown_alarm';
    try {
      const res = await completeChallenge(alarm_id, 'missed', new Date().toISOString(), attempts);
      if (res.offline) {
        await insertOfflineCompletion(alarm_id, 'missed', new Date().toISOString(), attempts);
      }
    } catch (err) {
      await insertOfflineCompletion(alarm_id, 'missed', new Date().toISOString(), attempts);
    }
    router.replace({
      pathname: '/alarm/missed',
      params: { alarmId: alarm_id },
    });
  };

  const handleKeyPress = (val: string) => {
    Vibration.vibrate(30); // light tap feedback
    if (val === 'DEL') {
      setInputValue((prev) => prev.slice(0, -1));
    } else if (inputValue.length < 6) {
      setInputValue((prev) => prev + val);
    }
  };

  const handleSubmit = async () => {
    if (!inputValue) return;
    const finalAttempts = attempts + 1;
    setAttempts(finalAttempts);

    if (inputValue === correctAnswer) {
      // SUCCESS
      setSubmitting(true);
      await stopAlarmSoundAndVibration(); // Stop alarm sound & vibration

      // Double short vibration on success
      Vibration.vibrate([0, 80, 40, 80]);

      const alarm_id = alarmId || 'unknown_alarm';
      try {
        const res = await completeChallenge(alarm_id, 'completed', new Date().toISOString(), finalAttempts);
        if (res.success) {
          router.replace({
            pathname: '/alarm/success',
            params: {
              wakeScore: res.wake_score?.toString() ?? '100',
              currentStreak: res.current_streak?.toString() ?? '1',
            },
          });
        } else if (res.offline) {
          await insertOfflineCompletion(alarm_id, 'completed', new Date().toISOString(), finalAttempts);
          router.replace({
            pathname: '/alarm/success',
            params: {
              wakeScore: 'Offline (Pending)',
              currentStreak: 'Offline (Pending)',
              offline: 'true',
            },
          });
        }
      } catch (err) {
        await insertOfflineCompletion(alarm_id, 'completed', new Date().toISOString(), finalAttempts);
        router.replace({
          pathname: '/alarm/success',
          params: {
            wakeScore: 'Offline (Pending)',
            currentStreak: 'Offline (Pending)',
            offline: 'true',
          },
        });
      }
    } else {
      // FAILURE - WRONG ANSWER
      Vibration.vibrate(200);
      setInputValue('');
      const { question, answer } = generateChallenge(difficulty);
      setQuestionText(question);
      setCorrectAnswer(answer);
      Alert.alert('Incorrect Answer', 'Try again! Think carefully.');
    }
  };

  const formatCountdown = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.groupName}>{groupName || 'Challenge Mode'}</Text>
        <Text style={styles.timer}>Time Left: {formatCountdown(timeLeft)}</Text>
      </View>

      <View style={styles.challengeContainer}>
        <Text style={styles.subtitle}>Solve this to silence alarm:</Text>
        <Text style={styles.questionText}>{questionText}</Text>
        <View style={styles.inputDisplay}>
          <Text style={styles.inputText}>{inputValue || '?'}</Text>
        </View>
        <Text style={styles.attempts}>Attempts: {attempts}</Text>
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', 'DEL'].map((val) => (
          <Pressable
            key={val}
            onPress={() => handleKeyPress(val)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            <Text style={styles.keyText}>{val}</Text>
          </Pressable>
        ))}
      </View>

      <Button
        title="Submit Answer"
        onPress={handleSubmit}
        disabled={inputValue === '' || submitting}
        loading={submitting}
        style={styles.submitBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#013237',
  },
  timer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  challengeContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 16,
  },
  inputDisplay: {
    width: 200,
    height: 52,
    borderWidth: 2,
    borderColor: '#4CA771',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  inputText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#013237',
  },
  attempts: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 12,
  },
  key: {
    width: '28%',
    aspectRatio: 1.5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  keyPressed: {
    backgroundColor: '#e5e7eb',
  },
  keyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#013237',
  },
  submitBtn: {
    width: '100%',
    height: 52,
    marginBottom: 16,
  },
});
