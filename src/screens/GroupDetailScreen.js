import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchGroupDetails();
    }
  }, [isFocused]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch group and challenge
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          *,
          challenges (*)
        `)
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // 2. Fetch members via RPC (avoids RLS recursion and allows listing all members)
      const { data: members, error: membersError } = await supabase.rpc('get_group_members', {
        p_group_id: groupId,
      });

      if (membersError) throw membersError;

      // Basic mock leaderboard for now
      setLeaderboard((members || []).map((m, index) => ({
        id: m.user_id,
        name: m.display_name || 'משתמש',
        points: 40 - (index * 10),
        streak: 5 - index,
        rank: index + 1,
      })));

    } catch (error) {
      Alert.alert('שגיאה', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderLeaderboardItem = ({ item }) => (
    <View style={styles.leaderboardItem}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{item.rank}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberStats}>🔥 {item.streak} ימים ברצף</Text>
      </View>
      <View style={styles.pointsContainer}>
        <Text style={styles.pointsText}>{item.points}</Text>
        <Text style={styles.pointsLabel}>⭐</Text>
      </View>
    </View>
  );

  if (loading || !group) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" animating={true} />
      </View>
    );
  }

  const challenge = group.challenges?.[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{group.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Invite', { groupId })}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.challengeCard}>
        <Text style={styles.challengeLabel}>יעד השבוע: {challenge?.name}</Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: '70%' }]} />
        </View>
        <Text style={styles.progressText}>5 / 8 חברים דיווחו השבוע</Text>
        
        <TouchableOpacity 
          style={styles.reportButton}
          onPress={() => navigation.navigate('Report', { challengeId: challenge?.id })}
        >
          <Text style={styles.reportButtonText}>דווח עכשיו ⚡</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>🏆 דירוג שבועי</Text>
      
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.id}
        renderItem={renderLeaderboardItem}
        contentContainerStyle={styles.leaderboardList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    color: '#6366F1',
    fontSize: 16,
  },
  settingsIcon: {
    fontSize: 22,
  },
  challengeCard: {
    margin: 20,
    backgroundColor: '#6366F1',
    borderRadius: 25,
    padding: 20,
    alignItems: 'center',
  },
  challengeLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  progressContainer: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 5,
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 5,
  },
  progressText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 20,
  },
  reportButton: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 15,
  },
  reportButtonText: {
    color: '#6366F1',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginBottom: 10,
    textAlign: 'right',
  },
  leaderboardList: {
    paddingHorizontal: 20,
  },
  leaderboardItem: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F3F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  rankText: {
    fontWeight: 'bold',
    color: '#495057',
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberStats: {
    fontSize: 12,
    color: '#FD7E14',
    marginTop: 2,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  pointsLabel: {
    marginLeft: 4,
  },
});

