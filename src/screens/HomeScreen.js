import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert, Image, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useI18n } from '../i18n/I18nProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useTheme } from '../theme/ThemeProvider';

const HOME_ORDER_KEY = 'todo:home:order:v1';
let didShowNetworkAlert = false;

function uniqIds(ids) {
  const out = [];
  const seen = new Set();
  for (const id of ids || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sortByOrder(items, orderIds) {
  const order = Array.isArray(orderIds) ? orderIds : [];
  const idx = new Map(order.map((id, i) => [id, i]));
  const withIndex = (items || []).map((g, i) => ({
    g,
    key: g?.id,
    ord: idx.has(g?.id) ? idx.get(g.id) : Number.MAX_SAFE_INTEGER,
    fallback: i,
  }));
  withIndex.sort((a, b) => (a.ord - b.ord) || (a.fallback - b.fallback));
  return withIndex.map((x) => x.g);
}

function moveSelectedToTop(list, selectedIds) {
  const sel = new Set(selectedIds || []);
  const top = [];
  const rest = [];
  for (const item of list || []) {
    if (sel.has(item.id)) top.push(item);
    else rest.push(item);
  }
  return [...top, ...rest];
}

function moveSelectedToBottom(list, selectedIds) {
  const sel = new Set(selectedIds || []);
  const top = [];
  const bottom = [];
  for (const item of list || []) {
    if (sel.has(item.id)) bottom.push(item);
    else top.push(item);
  }
  return [...top, ...bottom];
}

function formatValidity(challenge) {
  const s = challenge?.start_date ?? null;
  const e = challenge?.end_date ?? null;
  if (!s || !e) return null;
  return `${s} - ${e}`;
}

function parseYYYYMMDDLocal(s) {
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.split('-').map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function endOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatCountdown({ language, endDateString, now }) {
  const end = parseYYYYMMDDLocal(endDateString);
  if (!end) return null;
  const deadline = endOfLocalDay(end);
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return language === 'en' ? 'Completed' : 'האתגר הושלם';
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return language === 'en' ? `${days}d ${hours}h left` : `נותרו ${days} ימים ${hours} שעות`;
}

export default function HomeScreen({ navigation }) {
  const { t, language } = useI18n();
  const { colors, isDark } = useTheme();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [orderIds, setOrderIds] = useState([]);
  const [myRankByGroupId, setMyRankByGroupId] = useState({});

  const groupIconSource = (icon) => {
    switch (String(icon || '').trim()) {
      case 'run':
        return require('../../assets/images/run.png');
      case 'book':
        return require('../../assets/images/book.png');
      case 'water':
        return require('../../assets/images/water.png');
      case 'sleep':
        return require('../../assets/images/sleep.png');
      default:
        return null;
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchGroups();
    }
  }, [isFocused]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_ORDER_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setOrderIds(uniqIds(parsed));
      } catch (_e) {
        // ignore
      }
    })();
  }, []);

  const persistOrder = async (ids) => {
    try {
      await AsyncStorage.setItem(HOME_ORDER_KEY, JSON.stringify(uniqIds(ids)));
    } catch (_e) {
      // ignore
    }
  };

  function rankLabel(rank) {
    if (!rank || typeof rank !== 'number') return null;
    if (language === 'en') return `Rank #${rank}`;
    if (rank === 1) return 'את/ה מקום ראשון';
    if (rank === 2) return 'את/ה מקום שני';
    if (rank === 3) return 'את/ה מקום שלישי';
    return `את/ה מקום ${rank}`;
  }

  const computeMyRanks = async (groupIds) => {
    try {
      if (!Array.isArray(groupIds) || groupIds.length === 0) return;
      const { data, error } = await supabase.rpc('get_my_group_ranks', { p_group_ids: groupIds });
      if (error) throw error;
      const next = {};
      for (const gId of groupIds) next[String(gId)] = null;
      for (const row of data || []) {
        if (!row?.group_id) continue;
        next[String(row.group_id)] = typeof row.my_rank === 'number' ? row.my_rank : null;
      }
      setMyRankByGroupId(next);
    } catch (e) {
      console.log('computeMyRanks failed:', e?.message ?? e);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      let hiddenIds = new Set();
      if (userId) {
        const { data: hiddenRows, error: hiddenErr } = await supabase
          .from('user_hidden_groups')
          .select('group_id')
          .eq('user_id', userId);
        if (!hiddenErr && Array.isArray(hiddenRows)) {
          hiddenIds = new Set(hiddenRows.map((r) => r.group_id).filter(Boolean));
        }
      }

      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          challenges (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const fetchedAll = data || [];
      const fetched = fetchedAll.filter((g) => !hiddenIds.has(g.id));
      const sorted = sortByOrder(fetched, orderIds);
      setGroups(sorted);
      // Append new IDs to local order so reordering persists across refreshes
      const fetchedIds = fetched.map((g) => g.id).filter(Boolean);
      const nextOrder = uniqIds([...(orderIds || []), ...fetchedIds]);
      if (nextOrder.length !== (orderIds || []).length) {
        setOrderIds(nextOrder);
        persistOrder(nextOrder);
      }

      // Rank is per challenge/group (XP differs per group_id), so compute per group_id from reports.
      await computeMyRanks(fetched.map((g) => g.id).filter(Boolean));
    } catch (error) {
      const msg = String(error?.message || error || '');
      if (msg.toLowerCase().includes('network request failed')) {
        if (!didShowNetworkAlert) {
          didShowNetworkAlert = true;
          Alert.alert(
            language === 'en' ? 'No internet connection' : 'אין חיבור לאינטרנט',
            language === 'en'
              ? 'Please check your connection and try again.'
              : 'בדוק/י את החיבור לאינטרנט ונסה/י שוב.'
          );
        }
        return;
      }
      console.log('Error fetching groups:', msg);
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

  const toggleSelect = (groupId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedIds(new Set());
  };

  const applyReorder = async (nextGroups) => {
    setGroups(nextGroups);
    const ids = nextGroups.map((g) => g.id).filter(Boolean);
    setOrderIds(ids);
    await persistOrder(ids);
  };

  // Reordering is done via drag-and-drop in edit mode.

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      'מחיקה מהרשימה',
      `בטוח/ה שתרצה/י להסיר ${count} אתגרים ממסך הבית שלך? זה ישפיע רק עליך, ולא ימחק לחברים.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר/י',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { data: userData } = await supabase.auth.getUser();
              const userId = userData?.user?.id ?? null;
              if (!userId) throw new Error('משתמש לא מחובר');

              const ids = Array.from(selectedIds);
              for (const id of ids) {
                const { error } = await supabase
                  .from('user_hidden_groups')
                  .upsert({ user_id: userId, group_id: id }, { onConflict: 'user_id,group_id' });
                if (error) throw error;
              }
              const remaining = groups.filter((g) => !selectedIds.has(g.id));
              await applyReorder(remaining);
              exitEditMode();
            } catch (e) {
              Alert.alert('שגיאה', e?.message ?? 'לא הצלחנו להסיר את האתגרים');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderGroupItem = ({ item }) => {
    const ch = item.challenges?.[0] ?? null;
    const countdown = formatCountdown({ language, endDateString: ch?.end_date ?? null, now });
    const cardPressedBg = isDark ? '#111C33' : '#F3F4F6';
    const badgeBg = isDark ? '#2A1B0B' : '#FFF7ED';
    const badgeBorder = isDark ? '#3B2A12' : '#FFEDD5';
    const badgeTextColor = isDark ? '#FDBA74' : '#C2410C';
    return (
    // In MVP: one challenge == one group (group exists implicitly per challenge).
    <Pressable
      style={({ pressed }) => [
        styles.groupCard,
        { backgroundColor: pressed ? cardPressedBg : colors.card, borderColor: colors.border },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
      onPress={() => {
        if (editMode) toggleSelect(item.id);
        else navigation.navigate('GroupDetail', { groupId: item.id });
      }}
    >
      <View style={styles.cardHeader}>
        {groupIconSource(item.icon) ? (
          <Image source={groupIconSource(item.icon)} style={styles.groupIconImage} />
        ) : (
          <Text style={styles.groupIconEmoji}>{item.icon || '🏃‍♂️'}</Text>
        )}
        <View style={styles.groupInfo}>
          <View style={styles.nameRow}>
            {editMode ? (
              <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxOn]}>
                <Text style={styles.checkboxText}>{selectedIds.has(item.id) ? '✓' : ''}</Text>
              </View>
            ) : null}
            <Text style={[styles.groupName, { color: colors.text }]}>{item.challenges?.[0]?.name || item.name}</Text>
          </View>
          <Text style={[styles.challengeInfo, { color: colors.muted }]}>
            {formatValidity(item.challenges?.[0]) || t('home.validityMissing')}
          </Text>
          {countdown ? <Text style={[styles.countdownText, { color: colors.text }]}>{countdown}</Text> : null}
        </View>
      </View>


      <View style={styles.cardFooter}>
        <View style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
          <Text style={[styles.badgeText, { color: badgeTextColor }]}>
            {rankLabel(myRankByGroupId?.[item.id]) || (language === 'en' ? 'No rank yet' : 'אין דירוג עדיין')}
          </Text>
        </View>
      </View>
    </Pressable>
    );
  };

  const renderDraggableItem = ({ item, drag, isActive }) => {
    const ch = item.challenges?.[0] ?? null;
    const countdown = formatCountdown({ language, endDateString: ch?.end_date ?? null, now });
    const cardPressedBg = isDark ? '#111C33' : '#F3F4F6';
    const badgeBg = isDark ? '#2A1B0B' : '#FFF7ED';
    const badgeBorder = isDark ? '#3B2A12' : '#FFEDD5';
    const badgeTextColor = isDark ? '#FDBA74' : '#C2410C';
    return (
      <Pressable
        style={({ pressed }) => [
          styles.groupCard,
          { backgroundColor: pressed ? cardPressedBg : colors.card, borderColor: colors.border },
          (pressed || isActive) && { transform: [{ scale: 0.99 }] },
          isActive && { opacity: 0.9 },
        ]}
        onLongPress={drag}
        delayLongPress={150}
        onPress={() => toggleSelect(item.id)}
      >
        <View style={styles.cardHeader}>
          {groupIconSource(item.icon) ? (
            <Image source={groupIconSource(item.icon)} style={styles.groupIconImage} />
          ) : (
            <Text style={styles.groupIconEmoji}>{item.icon || '🏃‍♂️'}</Text>
          )}
          <View style={styles.groupInfo}>
            <View style={styles.nameRow}>
              <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxOn]}>
                <Text style={styles.checkboxText}>{selectedIds.has(item.id) ? '✓' : ''}</Text>
              </View>
              <Text style={[styles.groupName, { color: colors.text }]}>{item.challenges?.[0]?.name || item.name}</Text>
            </View>
            <Text style={[styles.challengeInfo, { color: colors.muted }]}>
              {formatValidity(item.challenges?.[0]) || t('home.validityMissing')}
            </Text>
            {countdown ? <Text style={[styles.countdownText, { color: colors.text }]}>{countdown}</Text> : null}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            <Text style={[styles.badgeText, { color: badgeTextColor }]}>
              {rankLabel(myRankByGroupId?.[item.id]) || (language === 'en' ? 'No rank yet' : 'אין דירוג עדיין')}
            </Text>
          </View>
          <Text style={[styles.dragHint, { color: colors.muted }]}>גרור/י ↕︎</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.editTopBtn}
          onPress={() => {
            if (editMode) exitEditMode();
            else setEditMode(true);
          }}
          activeOpacity={0.85}
        >
          {editMode ? (
            <Image source={require('../../assets/images/v.png')} style={styles.editTopImg} />
          ) : (
            <Image source={require('../../assets/images/edit.png')} style={styles.editTopImg} />
          )}
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={[styles.title, { color: colors.text }]}>{editMode ? 'עריכת אתגרים' : t('home.title')}</Text>
        </View>
      </View>

      {editMode ? (
        <View style={[styles.editBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.editCount, { color: colors.text }]}>מסומנים: {selectedIds.size}</Text>
          <View style={styles.editActions}>
            <TouchableOpacity style={[styles.editBtn, styles.editBtnDanger]} onPress={handleDeleteSelected} disabled={selectedIds.size === 0}>
              <Text style={[styles.editBtnText, { color: colors.primary }]}>הסר/י</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editBtn, styles.editBtnGhost]} onPress={exitEditMode}>
              <Text style={[styles.editBtnText, styles.editBtnGhostText, { color: colors.text }]}>סיום</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} animating={true} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('home.emptyTitle')}</Text>
          <Text style={[styles.emptySubText, { color: colors.muted }]}>{t('home.emptySubtitle')}</Text>
          
          <TouchableOpacity 
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('CreateGroup')}
          >
            <Text style={styles.emptyButtonText}>{t('home.createChallenge')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        editMode ? (
          <DraggableFlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderDraggableItem}
            contentContainerStyle={styles.listContainer}
            onDragEnd={async ({ data }) => {
              await applyReorder(data);
            }}
          />
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
          />
        )
      )}

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('CreateGroup')}
      >
        <Text style={styles.fabText}>{t('home.createChallenge')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.joinPill, { backgroundColor: isDark ? '#111827' : '#EEF2FF', borderColor: isDark ? colors.border : '#E0E7FF' }]}
        onPress={() => navigation.navigate('Join')}
        activeOpacity={0.85}
      >
        <Text style={[styles.joinPillText, { color: colors.primary }]}>{t('home.joinChallenge')}</Text>
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
    position: 'relative',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  editTopBtn: {
    position: 'absolute',
    left: 20,
    top: 58,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTopIcon: {
    fontSize: 18,
  },
  editTopImg: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    shadowRadius: 10,
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#F1F3F5',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 15,
  },
  nameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxOn: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  checkboxText: {
    fontWeight: '900',
    color: '#4F46E5',
    fontSize: 14,
    marginTop: -1,
  },
  groupIconEmoji: {
    fontSize: 40,
    marginLeft: 15,
  },
  groupIconImage: {
    width: 44,
    height: 44,
    marginLeft: 15,
    resizeMode: 'contain',
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
  countdownText: {
    fontSize: 12,
    color: '#111827',
    marginTop: 6,
    fontWeight: '900',
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
  dragHint: {
    fontWeight: '900',
    color: '#6C757D',
    fontSize: 12,
  },
  badge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
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
  editBar: {
    marginTop: -10,
    marginBottom: 10,
    marginHorizontal: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F3F5',
    borderRadius: 16,
    padding: 12,
  },
  editCount: {
    textAlign: 'right',
    fontWeight: '900',
    color: '#1A1C1E',
  },
  editActions: {
    marginTop: 10,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  editBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  editBtnDanger: {
    backgroundColor: '#FFF0F0',
    borderColor: '#FFD6D6',
  },
  editBtnGhost: {
    backgroundColor: '#FFF',
    borderColor: '#F1F3F5',
  },
  editBtnText: {
    fontWeight: '900',
    color: '#4F46E5',
  },
  editBtnGhostText: {
    color: '#495057',
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
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 30,
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 999,
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
    fontSize: 14,
    fontWeight: '900',
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
