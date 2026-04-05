import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Tag } from '../../components/common/Tag';
import { Header } from '../../components/common/Header';

export default function HomeScreen() {
  // =======================
  // 예시 코드 상태: Tag 선택 상태 관리
  // =======================
  const [selectedTags, setSelectedTags] = useState<string[]>(['욱신거림']);

  const toggleTag = (label: string) => {
    setSelectedTags((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  return (
    <View style={styles.screenRoot}>
      {/* =======================
          예시 코드: Header 컴포넌트 확인 (시작)
         ======================= */}
      <Header
        title="나아포 홈"
        leftIcon={<Text style={styles.headerDemoBackIcon}>‹</Text>}
        onPressLeft={() => router.back()}
        rightIcon={<Text style={styles.headerDemoRightLabel}>설정</Text>}
        onPressRight={() => {
          // 예: router.push('/settings');
        }}
        style={styles.headerDemoStretch}
        testID="header-home-demo"
        accessibilityLabel="나아포 홈 헤더"
      />
      {/* =======================
          예시 코드: Header 컴포넌트 확인 (끝)
         ======================= */}
      <View style={styles.container}>
        <Text style={styles.title}>🌊 나아포</Text>
        <Text style={styles.subtitle}>홈 화면</Text>

        {/* =======================
            예시 코드: Card 컴포넌트 확인
           ======================= */}
        <View style={styles.demoRow}>
          <Card
            variant="default"
            padding="sm"
            testID="card-demo-default"
            accessibilityLabel="기본 Card 예시"
          >
            <Text style={styles.demoText}>기본(Default)</Text>
          </Card>
        </View>

        <View style={styles.demoRow}>
          <Card
            variant="outlined"
            padding="sm"
            testID="card-demo-outlined"
            accessibilityLabel="아웃라인 Card 예시"
          >
            <Text style={styles.demoText}>아웃라인(Outlined)</Text>
          </Card>
        </View>

        <View style={styles.demoRow}>
          <Card
            variant="elevated"
            padding="sm"
            disabled={false}
            onPress={() => {
              // Pressable pressed 상태를 확인하기 위한 예시
            }}
            testID="card-demo-elevated"
            accessibilityLabel="클릭 가능한 Elevated Card 예시"
          >
            <Text style={styles.demoText}>눌러보기(Elevated)</Text>
          </Card>
        </View>

        <View style={styles.demoRow}>
          <Card
            variant="elevated"
            padding="sm"
            disabled
            onPress={() => {
              // disabled 이므로 눌러도 동작하지 않아야 함
            }}
            testID="card-demo-disabled"
            accessibilityLabel="비활성화 Elevated Card 예시"
          >
            <Text style={styles.demoText}>비활성화(Disabled)</Text>
          </Card>
        </View>
        {/* =======================
            예시 코드 끝
           ======================= */}

        {/* =======================
            예시 코드: Tag 컴포넌트 확인
           ======================= */}
        <View style={styles.tagDemoContainer}>
          <Text style={styles.tagDemoTitle}>통증 유형 태그 예시</Text>
          <View style={styles.tagWrap}>
            {['욱신거림', '찌르는 듯', '쑤시는 통증', '따가움'].map((label) => {
              const isSelected = selectedTags.includes(label);
              return (
                <View key={label} style={styles.tagItem}>
                  <Tag
                    label={label}
                    selected={isSelected}
                    onPress={() => toggleTag(label)}
                    variant={isSelected ? 'filled' : 'outlined'}
                    size="md"
                    testID={`pain-tag-${label}`}
                    accessibilityLabel={`통증 유형 ${label}`}
                  />
                </View>
              );
            })}
          </View>
        </View>
        {/* =======================
            예시 코드 끝 (Tag)
           ======================= */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerDemoStretch: {
    alignSelf: 'stretch',
  },
  headerDemoBackIcon: {
    fontSize: 28,
    color: '#4A90D9',
    marginTop: -4,
  },
  headerDemoRightLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A90D9',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textLight,
  },
  demoRow: {
    width: '90%',
    marginTop: 12,
  },
  demoText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  tagDemoContainer: {
    width: '90%',
    marginTop: 24,
  },
  tagDemoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagItem: {
    marginRight: 8,
    marginBottom: 8,
  },
});
