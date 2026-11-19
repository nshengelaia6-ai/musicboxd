
import { useRouter } from 'expo-router';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.brand}>musicboxd</Text>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated: November 2026</Text>

        <Text style={styles.paragraph}>
          Welcome to musicboxd. By creating an account or using
          musicboxd, you agree to these Terms of Service. If you
          do not agree, please do not use the app.
        </Text>

        <Text style={styles.heading}>1. About musicboxd</Text>
        <Text style={styles.paragraph}>
          musicboxd is a music-focused platform where users can
          manage their profiles, discover and share music, rate
          and review albums, follow other users, and keep track
          of their musical interests.
        </Text>

        <Text style={styles.heading}>2. Your account</Text>
        <Text style={styles.paragraph}>
          You are responsible for providing accurate account
          information and keeping your login credentials secure.
          You are responsible for activity carried out through
          your account. Please notify us if you believe your
          account has been accessed without your permission.
        </Text>

        <Text style={styles.heading}>3. Acceptable use</Text>
        <Text style={styles.paragraph}>
          You agree not to misuse musicboxd, interfere with its
          operation, attempt unauthorized access, impersonate
          another person, or use the platform to post unlawful,
          abusive, or infringing content.
        </Text>

        <Text style={styles.heading}>4. User content</Text>
        <Text style={styles.paragraph}>
          You remain responsible for content you submit, including
          reviews, ratings, profile information, and shared music
          activity. You must have the necessary rights to submit
          that content. You must not post content that violates
          another person&apos;s rights or applicable laws.
        </Text>

        <Text style={styles.heading}>5. Third-party services</Text>
        <Text style={styles.paragraph}>
          musicboxd may connect with third-party services,
          including Spotify. Your use of those services is also
          subject to their own terms and privacy policies.
          musicboxd does not own or control third-party services.
        </Text>

        <Text style={styles.heading}>6. Intellectual property</Text>
        <Text style={styles.paragraph}>
          The musicboxd name, branding, design, and original app
          materials belong to their respective owners. You may
          not copy, distribute, or commercially use these
          materials without permission.
        </Text>

        <Text style={styles.heading}>7. Availability and changes</Text>
        <Text style={styles.paragraph}>
          We may update, modify, suspend, or discontinue parts
          of musicboxd. We do not guarantee uninterrupted or
          error-free availability of the service.
        </Text>

        <Text style={styles.heading}>8. Account termination</Text>
        <Text style={styles.paragraph}>
          You may stop using musicboxd at any time. We may
          restrict or terminate access if these Terms are
          violated or if necessary to protect the service
          and its users.
        </Text>

        <Text style={styles.heading}>9. Changes to these Terms</Text>
        <Text style={styles.paragraph}>
          We may revise these Terms from time to time. Updated
          terms will be published on this page with a revised
          date. Continued use of musicboxd after changes take
          effect means you accept the updated Terms.
        </Text>

        <Text style={styles.heading}>10. Contact</Text>
        <Text style={styles.paragraph}>
          If you have questions about these Terms, please
          contact the musicboxd team.
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
