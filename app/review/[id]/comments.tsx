import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Reply = { id:string; review_id:string; user_id:string; reply_text:string; created_at:string };
type Person = { username:string|null; avatar_url:string|null };

export default function ReviewComments() {
  const { id } = useLocalSearchParams<{id:string}>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [replies,setReplies]=useState<Reply[]>([]);
  const [people,setPeople]=useState<Record<string,Person>>({});
  const [myProfile,setMyProfile]=useState<Person|null>(null);
  const [userId,setUserId]=useState('');
  const [replyText,setReplyText]=useState('');
  const [sending,setSending]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [{data:auth,error:authError},{data:review,error:reviewError},{data:rows,error:repliesError}]=await Promise.all([
        supabase.auth.getUser(),
        supabase.from('music_reviews').select('id,user_id').eq('id',String(id)).maybeSingle(),
        supabase.from('music_review_replies').select('id,review_id,user_id,reply_text,created_at').eq('review_id',String(id)).order('created_at',{ascending:true})
      ]);
      if(authError)throw authError;if(reviewError)throw reviewError;if(repliesError)throw repliesError;
      if(!review)throw new Error('Review not found.');
      const uid=auth.user?.id||'';setUserId(uid);
      const ids=[...new Set([review.user_id,...(rows||[]).map((item:any)=>item.user_id),...(uid?[uid]:[])])];
      const {data:profiles,error:profilesError}=await supabase.from('users').select('id,username,avatar_url').in('id',ids);
      if(profilesError)throw profilesError;
      const map:Record<string,Person>={};(profiles||[]).forEach((p:any)=>map[p.id]=p);
      setPeople(map);setMyProfile(uid?map[uid]||null:null);setReplies((rows||[]) as Reply[]);
    }catch(e:any){setError(e?.message||'Could not load comments.');}
    finally{setLoading(false);}
  },[id]);

  useFocusEffect(useCallback(()=>{void load();},[load]));

  async function sendReply(){
    const value=replyText.trim();if(!value||!userId||sending)return;
    setSending(true);setError('');
    try{
      const {data,error:insertError}=await supabase.from('music_review_replies').insert({review_id:String(id),user_id:userId,reply_text:value}).select('id,review_id,user_id,reply_text,created_at').single();
      if(insertError)throw insertError;
      setReplies(current=>[...current,data as Reply]);setReplyText('');
    }catch(e:any){setError(e?.message||'Could not send comment.');}
    finally{setSending(false);}
  }

  if(loading)return <View style={[styles.screen,{backgroundColor}]}><ActivityIndicator color={accentColor} style={{marginTop:80}}/></View>;

  return <View style={[styles.screen,{backgroundColor}]}>
    <View style={styles.header}>
      <TouchableOpacity onPress={()=>router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity>
      <Text style={styles.headerTitle}>COMMENTS</Text>
      <View style={{width:30}}/>
    </View>
    <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>{replies.length} {replies.length===1?'comment':'comments'}</Text>
        {replies.length===0?<Text style={styles.empty}>No comments yet. Be the first to comment.</Text>:replies.map(reply=>{
          const person=people[reply.user_id];
          return <View key={reply.id} style={styles.replyRow}>
            {person?.avatar_url?<Image source={{uri:person.avatar_url}} style={styles.avatar}/>:<View style={styles.avatar}/>}
            <View style={{flex:1}}>
              <View style={styles.nameRow}>
                <Text style={styles.username}>{person?.username||'listener'}</Text>
                <Text style={styles.date}>{new Date(reply.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.replyText}>{reply.reply_text}</Text>
            </View>
          </View>;
        })}
        {!!error&&<Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.composer}>
        {myProfile?.avatar_url?<Image source={{uri:myProfile.avatar_url}} style={styles.avatar}/>:<View style={styles.avatar}/>}
        <View style={{flex:1}}>
          <TextInput value={replyText} onChangeText={setReplyText} placeholder={userId?'Comment as '+(myProfile?.username||'you')+'...':'Sign in to comment'} placeholderTextColor="#777" multiline maxLength={2000} editable={!!userId} style={styles.input}/>
          <TouchableOpacity disabled={!replyText.trim()||sending||!userId} onPress={()=>void sendReply()} style={[styles.send,{backgroundColor:accentColor,opacity:!replyText.trim()||sending||!userId?0.5:1}]}>
            <Text style={styles.sendText}>{sending?'Posting...':'Post'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </View>;
}

const styles=StyleSheet.create({
  screen:{flex:1},keyboardArea:{flex:1},header:{height:104,paddingTop:58,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#252525'},
  back:{color:'#fff',fontSize:32,width:30},headerTitle:{color:'#fff',fontSize:16,fontWeight:'700',letterSpacing:1.5},
  content:{padding:18,paddingBottom:24},sectionTitle:{color:'#aaa',fontSize:13,fontWeight:'600',marginBottom:8},
  empty:{color:'#777',fontSize:13,paddingVertical:24,textAlign:'center'},
  replyRow:{flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#252525'},
  avatar:{width:32,height:32,borderRadius:16,backgroundColor:'#333'},nameRow:{flexDirection:'row',alignItems:'center',gap:9},
  username:{color:'#bbb',fontSize:12,fontWeight:'700'},date:{color:'#666',fontSize:10},
  replyText:{color:'#ddd',fontSize:14,lineHeight:21,marginTop:5},
  composer:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:18,borderTopWidth:1,borderTopColor:'#252525'},
  input:{minHeight:54,maxHeight:130,borderWidth:1,borderColor:'#383838',borderRadius:6,padding:10,color:'#fff',fontSize:14,textAlignVertical:'top'},
  send:{alignSelf:'flex-end',marginTop:8,paddingHorizontal:18,paddingVertical:9,borderRadius:6},sendText:{color:'#fff',fontSize:12,fontWeight:'700'},
  error:{color:'#ff7777',paddingVertical:12}
});