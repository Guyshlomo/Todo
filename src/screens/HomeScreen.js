import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

export default function HomeScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchGroups();
    }
  }, [isFocused]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          challenges (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchGroups();
    } finally {
      setRefreshing(false);
    }
  };

  const progress = 0.67; // TODO: compute from reports per current period

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.groupIcon}>{item.icon || '🏃‍♂️'}</Text>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.challengeInfo}>
            {item.challenges?.[0]?.name || 'אין אתגר פעיל'}
          </Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>מוביל השבוע 🏆</Text>
        </View>
        <Text style={styles.streakText}>🔥 רצף: 4</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <Text style={styles.title}>האתגרים שלי</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 50 }} animating={true} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>עדיין אין לך קבוצות...</Text>
          <Text style={styles.emptySubText}>צור קבוצה חדשה כדי להתחיל!</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGroup')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.joinPill}
        onPress={() => navigation.navigate('Join')}
        activeOpacity={0.85}
      >
        <Text style={styles.joinPillText}>להצטרפות לקבוצה</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1C1E',
  },
  subtitleSmall: {
    color: '#6C757D',
    fontWeight: '700',
    marginBottom: 6,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  groupCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 15,
  },
  groupIcon: {
    fontSize: 40,
    marginLeft: 15,
  },
  groupInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1C1E',
  },
  challengeInfo: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  progressWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    overflow: 'hidden',
    marginLeft: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 999,
  },
  progressText: {
    fontWeight: '900',
    color: '#1A1C1E',
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
    paddingTop: 12,
  },
  badge: {
    backgroundColor: '#FFF7ED',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: 'bold',
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FD7E14',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#495057',
  },
  emptySubText: {
    fontSize: 16,
    color: '#6C757D',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 30,
    backgroundColor: '#6366F1',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    color: '#FFF',
    fontSize: 35,
    fontWeight: '300',
  },
  joinPill: {
    position: 'absolute',
    bottom: 42,
    left: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  joinPillText: {
    color: '#4F46E5',
    fontWeight: '900',
  },
});
