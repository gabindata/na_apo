import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

export default function ApoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🐬</Text>
      <Text style={styles.title}>아포</Text>
      <Text style={styles.subtitle}>의료 상담 챗봇</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textLight,
  },
});
