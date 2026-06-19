import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { GroupMember } from '@/store/groupStore';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

interface MemberStatusGridProps {
  members: GroupMember[];
}

export default function MemberStatusGrid({ members }: MemberStatusGridProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Group Roster & Status</Text>
      <View style={styles.grid}>
        {members.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.row}>
              <Avatar name={member.user?.full_name || member.user?.email} url={member.user?.avatar_url} size={36} />
              <View style={styles.details}>
                <Text style={styles.name} numberOfLines={1}>
                  {member.user?.full_name || member.user?.email || 'Unknown'}
                </Text>
                <Text style={styles.stats}>
                  Score: {Math.round(member.wake_score || 0)}% | Streak: {member.current_streak || 0}d
                </Text>
              </View>
            </View>
            <View style={styles.badgeWrapper}>
              <Badge
                label={
                  member.total_alarms_received > 0
                    ? `Done: ${member.total_completed}/${member.total_alarms_received}`
                    : 'No Alarms'
                }
                status={
                  member.total_alarms_received === 0
                    ? 'default'
                    : member.wake_score > 80
                    ? 'completed'
                    : member.wake_score > 50
                    ? 'pending'
                    : 'missed'
                }
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  memberCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  details: {
    marginLeft: 8,
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#013237',
  },
  stats: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  badgeWrapper: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
});
