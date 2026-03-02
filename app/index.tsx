import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';

const TEAMS = [
  'Arsenal',
  'Chelsea',
  'Liverpool',
  'Manchester City',
  'Manchester United',
  'Tottenham Hotspur',
  'Barcelona',
  'Real Madrid',
  'Bayern Munich',
  'Juventus',
];

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const filtered = TEAMS.filter((team) =>
    team.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lineup Master</Text>
      <View style={styles.searchRow}>
        <Search size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search football teams..."
          placeholderTextColor="#888"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.teamItem}
            onPress={() => router.push({ pathname: '/board', params: { team: item } })}
          >
            <Text style={styles.teamText}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#1a1a1a',
  },
  teamItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  teamText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
});
