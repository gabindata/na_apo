import { ScrollView, StyleSheet, Text, View, Image, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import {
  MAGAZINES,
  getMagazineById,
  type Magazine,
  type MagazineBlock,
} from '../../constants/magazines';
import { Colors } from '../../constants/colors';

const H_PAD = 32;

export default function MagazineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const magazine = getMagazineById(id ?? '');
  const contentWidth = screenWidth - H_PAD * 2;
  const maxImageHeight = screenHeight * 0.4;

  if (!magazine) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>매거진을 찾을 수 없어요.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.backBtnText}>← 뒤로</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.title}>{magazine.title}</Text>
          <Text style={styles.subtitle}>{magazine.subtitle}</Text>
        </View>

        {magazine.content.map((block, index) => (
          <MagazineBlockView
            key={index}
            block={block}
            contentWidth={contentWidth}
            maxImageHeight={maxImageHeight}
          />
        ))}

        <OtherMagazinesSection
          currentId={magazine.id}
          onPressMagazine={(nextId) => router.replace(`/magazine/${nextId}`)}
        />
      </ScrollView>
    </View>
  );
}

function OtherMagazinesSection({
  currentId,
  onPressMagazine,
}: {
  currentId: string;
  onPressMagazine: (id: string) => void;
}) {
  const others = MAGAZINES.filter((m) => m.id !== currentId);
  if (others.length === 0) return null;

  return (
    <View style={styles.othersSection}>
      <View style={styles.othersDivider} />
      <Text style={styles.othersTitle}>다른 매거진도 읽어보세요</Text>
      <View style={styles.othersList}>
        {others.map((mag) => (
          <OtherMagazineCard
            key={mag.id}
            magazine={mag}
            onPress={() => onPressMagazine(mag.id)}
          />
        ))}
      </View>
    </View>
  );
}

function OtherMagazineCard({
  magazine,
  onPress,
}: {
  magazine: Magazine;
  onPress: () => void;
}) {
  const thumb = magazine.content.find(
    (block): block is Extract<MagazineBlock, { type: 'image' }> => block.type === 'image',
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.otherCard, pressed && styles.otherCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${magazine.title} 매거진으로 이동`}
    >
      <View style={styles.otherThumbWrap}>
        {thumb ? (
          <Image source={thumb.source} style={styles.otherThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.otherThumb, styles.otherThumbPlaceholder]} />
        )}
      </View>
      <View style={styles.otherTextWrap}>
        <Text style={styles.otherTitle} numberOfLines={2}>
          {magazine.title}
        </Text>
        <Text style={styles.otherSubtitle} numberOfLines={2}>
          {magazine.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function MagazineBlockView({
  block,
  contentWidth,
  maxImageHeight,
}: {
  block: MagazineBlock;
  contentWidth: number;
  maxImageHeight: number;
}) {
  switch (block.type) {
    case 'image': {
      const ratio = block.aspectRatio && block.aspectRatio > 0 ? block.aspectRatio : 1.4;
      const imageHeight = Math.min(contentWidth / ratio, maxImageHeight);
      return (
        <View style={[styles.imageWrapper, { height: imageHeight }]}>
          <Image source={block.source} style={styles.image} resizeMode="contain" />
        </View>
      );
    }

    case 'heading':
      return <Text style={styles.heading}>{block.text}</Text>;

    case 'body':
      return (
        <Text
          style={styles.body}
          lineBreakStrategyIOS="standard"
          textBreakStrategy="simple"
        >
          {block.text}
        </Text>
      );

    case 'tips':
      return (
        <View style={styles.tipsBox}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipBullet}>✅</Text>
              <Text
                style={styles.tipText}
                lineBreakStrategyIOS="standard"
                textBreakStrategy="simple"
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      );

    case 'divider':
      return <View style={styles.divider} />;

    case 'highlight':
      return (
        <View style={styles.highlightBox}>
          <Text style={styles.highlightLabel}>꼭 기억하세요</Text>
          <Text
            style={styles.highlightText}
            lineBreakStrategyIOS="standard"
            textBreakStrategy="simple"
          >
            {block.text}
          </Text>
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: H_PAD,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.ocean?.tideBorder ?? '#D0E8F2',
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backBtnPressed: {
    opacity: 0.5,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 24,
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textLight,
    lineHeight: 22,
  },
  imageWrapper: {
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.ocean?.heroWash ?? '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
    marginTop: 8,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 25,
    color: Colors.text,
    marginBottom: 14,
    textAlign: 'left',
    letterSpacing: -0.3,
  },
  tipsBox: {
    gap: 10,
    marginVertical: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipBullet: {
    fontSize: 15,
    lineHeight: 23,
  },
  tipText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 25,
    color: Colors.text,
    textAlign: 'left',
    letterSpacing: -0.3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.ocean?.tideBorder ?? '#D0E8F2',
    marginVertical: 20,
  },
  highlightBox: {
    backgroundColor: Colors.ocean?.heroWash ?? '#EBF5FB',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginVertical: 8,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  highlightText: {
    fontSize: 15,
    lineHeight: 25,
    color: Colors.text,
    textAlign: 'left',
    letterSpacing: -0.3,
  },
  othersSection: {
    marginTop: 12,
  },
  othersDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.ocean?.tideBorder ?? '#D0E8F2',
    marginBottom: 18,
  },
  othersTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  othersList: {
    gap: 10,
  },
  otherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ocean?.tideBorder ?? '#D0E8F2',
    backgroundColor: Colors.white ?? '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    gap: 12,
  },
  otherCardPressed: {
    opacity: 0.7,
  },
  otherThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.ocean?.heroWash ?? '#EBF5FB',
  },
  otherThumb: {
    width: '100%',
    height: '100%',
  },
  otherThumbPlaceholder: {
    backgroundColor: Colors.ocean?.heroWash ?? '#EBF5FB',
  },
  otherTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  otherTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  otherSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textLight,
    lineHeight: 18,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textLight,
  },
});
