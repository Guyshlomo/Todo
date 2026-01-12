import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, Image, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { ChevronLeft, Flame, Trophy, Calendar, CheckCircle2, User as UserIcon, X } from 'lucide-react-native';

function endOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseYYYYMMDDLocal(s) {
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.split('-').map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchGroupDetails();
    }
  }, [isFocused]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
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

      const { data: members, error: membersError } = await supabase.rpc('get_group_members', {
        p_group_id: groupId,
      });

      if (membersError) throw membersError;

      // RPC may not include up-to-date XP. Pull XP (total_points) from `users` table for trust.
      const memberIds = (members || []).map((m) => m.user_id).filter(Boolean);
      let usersById = {};
      if (memberIds.length > 0) {
        const { data: usersRows, error: usersErr } = await supabase
          .from('users')
          .select('id, display_name, avatar_url, total_points')
          .in('id', memberIds);
        if (!usersErr && Array.isArray(usersRows)) {
          usersById = Object.fromEntries(usersRows.map((u) => [u.id, u]));
        }
      }

      const combined = (members || []).map((m) => {
        const u = usersById[m.user_id] || null;
        return {
          id: m.user_id,
          name: u?.display_name || m.display_name || 'משתמש',
          points: typeof u?.total_points === 'number' ? u.total_points : 0,
          streak: m.streak || 0,
          avatar_url: u?.avatar_url || m.avatar_url,
        };
      });

      combined.sort((a, b) => (b.points || 0) - (a.points || 0));
      setLeaderboard(combined.map((item, idx) => ({ ...item, rank: idx + 1 })));

    } catch (error) {
      Alert.alert('שגיאה', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserChallengeHistory = async (userId) => {
    setLoadingReports(true);
    try {
      const challengeId = group.challenges?.[0]?.id;
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserReports(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleUserPress = (user) => {
    setSelectedUser(user);
    fetchUserChallengeHistory(user.id);
  };

  const renderLeaderboardItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.leaderboardItem}
      onPress={() => handleUserPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{item.rank}</Text>
      </View>
      <View style={styles.avatarMini}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
        ) : (
          <UserIcon size={16} color="#6C757D" />
        )}
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberStats}>🔥 {item.streak} ימים ברצף</Text>
      </View>
      <View style={styles.pointsContainer}>
        <Text style={styles.pointsText}>{item.points}</Text>
        <Text style={styles.pointsLabel}>⭐</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading || !group) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" animating={true} />
      </View>
    );
  }

  const challenge = group.challenges?.[0];
  const challengeEnd = parseYYYYMMDDLocal(challenge?.end_date);
  const isChallengeCompleted = challengeEnd ? new Date() > endOfLocalDay(challengeEnd) : false;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#6366F1" size={24} />
          <Text style={styles.backButton}>חזרה</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{challenge?.name || group.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Invite', { groupId })}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Trophy color="#FFF" size={24} />
            <Text style={styles.challengeLabel}>{challenge?.name || 'אתגר'}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <Calendar color="rgba(255,255,255,0.8)" size={16} />
            <Text style={styles.challengeMeta}>
              {challenge?.start_date && challenge?.end_date
                ? `${challenge.start_date} - ${challenge.end_date}`
                : 'תוקף האתגר לא הוגדר'}
            </Text>
          </View>

          <View style={styles.statusBadge}>
            {isChallengeCompleted ? (
              <Text style={styles.statusTextDone}>האתגר הושלם ✅</Text>
            ) : (
              <Text style={styles.statusTextActive}>יש לך זמן 💪</Text>
            )}
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>התקדמות הקבוצה</Text>
              <Text style={styles.progressPercent}>70%</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: '70%' }]} />
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.reportButton, isChallengeCompleted && styles.reportButtonDisabled]}
            onPress={() => navigation.navigate('Report', { challengeId: challenge?.id, groupId })}
            disabled={isChallengeCompleted}
          >
            <Text style={styles.reportButtonText}>
              {isChallengeCompleted ? 'האתגר הסתיים' : 'דווח עכשיו ⚡'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>🏆 לוח תוצאות</Text>
        
        <View style={styles.leaderboardContainer}>
          {leaderboard.map((item) => (
            <View key={item.id}>
              {renderLeaderboardItem({ item })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* User History Modal */}
      <Modal
        visible={!!selectedUser}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Text style={styles.modalClose}>סגור</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>פרופיל באתגר</Text>
              <View style={{ width: 40 }} />
            </View>

            {selectedUser && (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                <View style={styles.userProfileHeader}>
                  <View style={styles.userAvatarLarge}>
                    {selectedUser.avatar_url ? (
                      <Image source={{ uri: selectedUser.avatar_url }} style={styles.avatarImgLarge} />
                    ) : (
                      <UserIcon size={40} color="#6C757D" />
                    )}
                  </View>
                  <Text style={styles.userProfileName}>{selectedUser.name}</Text>
                  
                  <View style={styles.userProfileStats}>
                    <View style={styles.userStatBox}>
                      <Flame color="#FD7E14" size={24} />
                      <Text style={styles.userStatValue}>{selectedUser.streak}</Text>
                      <Text style={styles.userStatLabel}>רצף</Text>
                    </View>
                    <View style={styles.userStatBox}>
                      <Trophy color="#6366F1" size={24} />
                      <Text style={styles.userStatValue}>{selectedUser.points}</Text>
                      <Text style={styles.userStatLabel}>XP</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.historyTitle}>היסטוריית דיווחים</Text>
                {loadingReports ? (
                  <ActivityIndicator color="#6366F1" style={{ marginTop: 20 }} />
                ) : userReports.length === 0 ? (
                  <Text style={styles.emptyHistory}>עדיין אין דיווחים באתגר זה</Text>
                ) : (
                  userReports.map((report) => (
                    <View key={report.id} style={styles.reportRow}>
                      <View style={styles.reportStatus}>
                        {report.is_done ? (
                          <CheckCircle2 color="#22C55E" size={20} />
                        ) : (
                          <X color="#FF5252" size={20} />
                        )}
                      </View>
                      <View style={styles.reportMain}>
                        <Text style={styles.reportDate}>
                          {new Date(report.created_at).toLocaleDateString('he-IL')}
                        </Text>
                        {report.proof_text && (
                          <Text style={styles.reportProofText}>"{report.proof_text}"</Text>
                        )}
                        {report.proof_image_url && (
                          <Image source={{ uri: report.proof_image_url }} style={styles.reportProofImg} />
                        )}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  backBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1C1E',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  backButton: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsIcon: {
    fontSize: 22,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  challengeCard: {
    margin: 20,
    backgroundColor: '#6366F1',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  challengeHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  challengeLabel: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  challengeMeta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  statusTextActive: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  statusTextDone: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  progressSection: {
    width: '100%',
    marginBottom: 24,
  },
  progressLabelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  progressPercent: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  reportButton: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  reportButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  reportButtonText: {
    color: '#6366F1',
    fontWeight: 'bold',
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 24,
    marginBottom: 16,
    textAlign: 'right',
    color: '#1A1C1E',
  },
  leaderboardContainer: {
    paddingHorizontal: 20,
  },
  leaderboardItem: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  rankText: {
    fontWeight: '900',
    color: '#495057',
    fontSize: 12,
  },
  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1C1E',
  },
  memberStats: {
    fontSize: 12,
    color: '#FD7E14',
    marginTop: 2,
    fontWeight: '700',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#6366F1',
  },
  pointsLabel: {
    marginLeft: 4,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  modalClose: {
    color: '#6366F1',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 24,
  },
  userProfileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userAvatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#EEF2FF',
  },
  avatarImgLarge: {
    width: '100%',
    height: '100%',
  },
  userProfileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1C1E',
    marginBottom: 24,
  },
  userProfileStats: {
    flexDirection: 'row-reverse',
    gap: 16,
    width: '100%',
  },
  userStatBox: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  userStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1C1E',
    marginTop: 8,
  },
  userStatLabel: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '700',
    marginTop: 2,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 16,
    color: '#1A1C1E',
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#6C757D',
    marginTop: 20,
  },
  reportRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
    gap: 16,
  },
  reportStatus: {
    paddingTop: 4,
  },
  reportMain: {
    flex: 1,
    alignItems: 'flex-end',
  },
  reportDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 8,
  },
  reportProofText: {
    fontSize: 14,
    color: '#1A1C1E',
    fontStyle: 'italic',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    textAlign: 'right',
  },
  reportProofImg: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
});
