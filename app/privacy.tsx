
import { useRouter } from 'expo-router';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.brand}>musicboxd</Text>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: November 2026</Text>

        <Text style={styles.paragraph}>
          Your privacy matters to us. This Privacy Policy explains
          what information musicboxd may collect, how it is used,
          and how it is handled when you use the app.
        </Text>

        <Text style={styles.heading}>1. Information we collect</Text>
        <Text style={styles.paragraph}>
          When you create an account, we may collect your email
          address, username, password authentication data, and
          optional date of birth.
        </Text>
        <Text style={styles.paragraph}>
          When you use musicboxd, information may also be stored
          about your profile, follows, shared songs, ratings,
          album reviews, and monthly favorites.
        </Text>

        <Text style={styles.heading}>2. Spotify connection</Text>
        <Text style={styles.paragraph}>
          If you choose to connect Spotify, musicboxd may access
          Spotify account information and music-related data
          permitted by the permissions you approve. Spotify
          connection is optional.
        </Text>
        <Text style={styles.paragraph}>
          Spotify handles its own data according to its Privacy
          Policy. You can manage or revoke musicboxd's access
          through your Spotify account settings.
        </Text>

        <Text style={styles.heading}>3. How we use information</Text>
        <Text style={styles.paragraph}>
          We use information to create and manage accounts,
          provide app features, display profiles and music
          activity, enable social interactions, maintain security,
          and improve the service.
        </Text>

        <Text style={styles.heading}>4. Data storage</Text>
        <Text style={styles.paragraph}>
          musicboxd uses Supabase for authentication and app data
          storage. Information is processed and stored through
          the services needed to operate the platform.
        </Text>

        <Text style={styles.heading}>5. Sharing and visibility</Text>
        <Text style={styles.paragraph}>
          Some information and activity may be visible to other
          users depending on the features you use, including
          your profile, reviews, ratings, follows, and shared
          music activity. Please consider this before posting
          information to your profile.
        </Text>

        <Text style={styles.heading}>6. Third-party services</Text>
        <Text style={styles.paragraph}>
          musicboxd may rely on third-party providers such as
          Supabase and Spotify. These providers process data
          under their own terms and privacy policies.
        </Text>

        <Text style={styles.heading}>7. Data retention and deletion</Text>
        <Text style={styles.paragraph}>
          We retain information for as long as needed to provide
          the service and for legitimate operational or legal
          purposes. You may request account deletion through
          the available account deletion feature. Deletion of
          information may be subject to applicable legal or
          technical requirements.
        </Text>

        <Text style={styles.heading}>8. Security</Text>
        <Text style={styles.paragraph}>
          We take reasonable steps to protect account and app
          information. However, no method of electronic storage
          or transmission can be guaranteed to be completely
          secure.
        </Text>

        <Text style={styles.heading}>9. Children's privacy</Text>
        <Text style={styles.paragraph}>
          musicboxd is not intended for children who are below
          the minimum age required to use the service under
          applicable law.
        </Text>

        <Text style={styles.heading}>10. Changes to this Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy as musicboxd evolves.
          Any changes will be published on this page with an
          updated date.
        </Text>

        <Text style={styles.heading}>11. Contact</Text>
        <Text style={styles.paragraph}>
          If you have questions about this Privacy Policy or
          your personal information, please contact the
          musicboxd team.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>YOUR MUSIC. YOUR WORLD.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14181c',
  },
  container: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 50,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    marginBottom: 24,
  },
  backText: {
    color: '#729bc5',
    fontSize: 14,
    fontWeight: '600',
  },
  brand: {
    color: '#729bc5',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  title: {
    color: '#f1f3f5',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  updated: {
    color: '#74818c',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 28,
  },
  heading: {
    color: '#f1f3f5',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 28,
    marginBottom: 10,
  },
  paragraph: {
    color: '#aeb8c2',
    fontSize: 14,
    lineHeight: 24,
    marginBottom: 12,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#2b323a',
    marginTop: 40,
    paddingTop: 22,
    alignItems: 'center',
  },
  footerText: {
    color: '#74818c',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
});
