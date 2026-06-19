import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Group } from '@/store/groupStore';
import Card from '../ui/Card';

interface GroupCardProps {
  group: Group;
}

export default function GroupCard({ group }: GroupCardProps) {
  return (
    <Link href={`/group/${group.id}`} asChild>
      <Pressable>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.name}>{group.name}</Text>
            <Text style={styles.count}>{group.member_count} members</Text>
          </View>
          {group.description && <Text style={styles.description}>{group.description}</Text>}
          <Text style={styles.invite}>Invite Code: {group.invite_code}</Text>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#013237',
  },
  count: {
    fontSize: 12,
    color: '#6b7280',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginVertical: 4,
  },
  invite: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CA771',
    marginTop: 4,
  },
});
