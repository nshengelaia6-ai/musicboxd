
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
        <Text style={styles.updated}>Last updated: November 19, 2026</Text>

        <Text style={styles.paragraph}>
          Your privacy matters to us. This Privacy Policy explains
          what information musicboxd may collect, how it is used,
          and how it is handled when you use the app.
        </Text>

        <Text style={styles.heading}>1. Information we collect</Text>
        <Text style={styles.paragraph}>
          When you create an account, we process your email address,
          username, and password authentication data. If you choose
          to provide a date of birth during sign-up, it is also
          processed. Your password is handled by Supabase
          Authentication; Musicboxd does not need to display or
          store your plain-text password.
        </Text>
        <Text style={styles.paragraph}>
          When you use Musicboxd, we may process profile details
          (including your bio and avatar), follows and followers,
          shared songs and related interactions, ratings, album
          reviews, listening activity, lists, and favorites. Some
          information is stored in the app on your device and some
          is stored in our Supabase database.
        </Text>

        <Text style={styles.heading}>2. How we use information</Text>
        <Text style={styles.paragraph}>
          We use information to authenticate users, maintain
          profiles, provide music and social features, display
          information you choose to share, synchronize app activity,
          protect the service, troubleshoot errors, and maintain
          the app. We do not need your account password in readable
          form to provide these features.
        </Text>

        <Text style={styles.heading}>3. Data storage</Text>
        <Text style={styles.paragraph}>
          Musicboxd uses Supabase for account authentication,
          database storage, and file storage. Some app information may
          also be stored locally on your device. Musicboxd uses
          Spotify&apos;s public music catalog for search and metadata. The services and
          infrastructure used to operate Musicboxd may process
          information in locations outside your country.
        </Text>

        <Text style={styles.heading}>4. Sharing and visibility</Text>
        <Text style={styles.paragraph}>
          Profile information and social or music activity may be
          visible to other Musicboxd users through public profile,
          review, follow, shared-song, and activity features.
          Information you submit to a social feature should be
          treated as potentially visible to other users. Do not
          include sensitive personal information in your profile,
          reviews, or shared content. Musicboxd does not currently
          offer a complete set of per-field privacy controls.
        </Text>

        <Text style={styles.heading}>5. Third-party services</Text>
        <Text style={styles.paragraph}>
          Musicboxd relies on third-party providers, including
          Supabase for authentication, database, and file services,
          and Spotify&apos;s public music catalog through server-side search.
          These providers process information under their own
          terms and privacy policies. Musicboxd does not control
          their independent services.
        </Text>

        <Text style={styles.heading}>6. Data retention and deletion</Text>
        <Text style={styles.paragraph}>
          We retain account and app information while it is needed
          to operate your account and provide the service. You can
          start permanent account deletion from Privacy & Settings.
          The deletion process removes your Musicboxd account and
          associated application records and avatar files. Some
          information may remain temporarily in backups, logs, or
          third-party systems, or where retention is required by
          law. Local app data is cleared from the device used for
          deletion; data on other devices may need to be cleared
          separately.
        </Text>

        <Text style={styles.heading}>7. Your choices and requests</Text>
        <Text style={styles.paragraph}>
          You can edit profile information in the app and request
          permanent deletion
          through Privacy & Settings. Depending on your location,
          you may also have rights to access, correct, or request
          deletion of personal information, subject to applicable
          law. The app does not currently provide a downloadable
          data-export tool or granular privacy controls for every
          type of activity.
        </Text>

        <Text style={styles.heading}>8. Security</Text>
        <Text style={styles.paragraph}>
          We use authentication, access controls, and service
          security features intended to protect account and app
          information. No method of storage or transmission is
          completely secure, and we cannot guarantee absolute
          security. Keep your password private and sign out on
          devices you do not control.
        </Text>

        <Text style={styles.heading}>9. Children&apos;s privacy</Text>
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
          For questions about this policy or a privacy request,
          contact the Musicboxd team through the official support
          channel provided with the service. A direct privacy
          contact address should be published here before
          Musicboxd is made publicly available.
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
