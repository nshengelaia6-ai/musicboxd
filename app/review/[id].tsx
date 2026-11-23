import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Review = {
  id:string; user_id:string; item_type:string; item_id:string; item_name:string;
  artist_name:string; cover_url:string; rating:number; review_text:string;
};
type Reply = { id:string; review_id:string; user_id:string; reply_text:string; created_at:string };
type Person = { username:string|null; avatar_url:string|null };

export default function ReviewDetail() {
  const { id } = useLocalSearchParams<{id:string}>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [review,setReview]=useState<Review|null>(null);
  const [author,setAuthor]=useState<Person|null>(null);
  const [replies,setReplies]=useState<Reply[]>([]);
  const [replyPeople,setReplyPeople]=useState<Record<string,Person>>({});
  const [replyText,setReplyText]=useState('');
  const [replyOpen,setReplyOpen]=useState(false);
  const [userId,setUserId]=useState('');
  const [likes,setLikes]=useState(0);
  const [liked,setLiked]=useState(false);
  const [sending,setSending]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const [{data:auth,error:authError},{data:row,error:reviewError}]=await Promise.all([
        supabase.auth.getUser(),
        supabase.from('music_reviews').select('id,user_id,item_type,item_id,item_name,artist_name,cover_url,rating,review_text').eq('id',String(id)).maybeSingle()
      ]);
      if(authError) throw authError;
      if(reviewError) throw reviewError;
      if(!row) {setReview(null);return;}
      const uid=auth.user?.id||'';setUserId(uid);setReview(row as Review);
      const [{data:profile,error:profileError},{data:likeRows,error:likesError},{data:myLike,error:myLikeError},{data:replyRows,error:repliesError}]=await Promise.all([
        supabase.from('users').select('username,avatar_url').eq('id',row.user_id).maybeSingle(),
        supabase.from('music_review_likes').select('user_id').eq('review_id',row.id),
        uid?supabase.from('music_review_likes').select('review_id').eq('review_id',row.id).eq('user_id',uid).maybeSingle():Promise.resolve({data:null,error:null} as any),
        supabase.from('music_review_replies').select('id,review_id,user_id,reply_text,created_at').eq('review_id',row.id).order('created_at',{ascending:true})
      ]);
      if(profileError) throw profileError;if(likesError) throw likesError;if(myLikeError) throw myLikeError;if(repliesError) throw repliesError;
      setAuthor(profile as Person|null);setLikes((likeRows||[]).length);setLiked(!!myLike);
      const loadedReplies=(replyRows||[]) as Reply[];setReplies(loadedReplies);
      const ids=[...new Set(loadedReplies.map(item=>item.user_id))];
      if(ids.length){
        const {data:profiles,error:replyProfilesError}=await supabase.from('users').select('id,username,avatar_url').in('id',ids);
        if(replyProfilesError) throw replyProfilesError;
        const map:Record<string,Person>={};(profiles||[]).forEach((p:any)=>map[p.id]=p);setReplyPeople(map);
      } else setReplyPeople({});
    } catch(e:any){setError(e?.message||'Could not load this review.');}
    finally{setLoading(false);}
  },[id]);

  useFocusEffect(useCallback(()=>{void load();},[load]));

  async function toggleLike(){
    if(!userId||!review)return;
    const wasLiked=liked;setLiked(!wasLiked);setLikes(v=>Math.max(0,v+(wasLiked?-1:1)));
    try{
      if(wasLiked){
        const {error:deleteError}=await supabase.from('music_review_likes').delete().eq('review_id',review.id).eq('user_id',userId);
        if(deleteError)throw deleteError;
      }else{
        const {error:insertError}=await supabase.from('music_review_likes').upsert({review_id:review.id,user_id:userId},{onConflict:'review_id,user_id'});
        if(insertError)throw insertError;
      }
    }catch(e:any){setLiked(wasLiked);setLikes(v=>Math.max(0,v+(wasLiked?1:-1)));setError(e?.message||'Could not update like.');}
  }

  async function sendReply(){
    const value=replyText.trim();if(!value||!userId||!review||sending)return;
    setSending(true);
    try{
      const {data,error:insertError}=await supabase.from('music_review_replies').insert({review_id:review.id,user_id:userId,reply_text:value}).select('id,review_id,user_id,reply_text,created_at').single();
      if(insertError)throw insertError;
      setReplies(current=>[...current,data as Reply]);setReplyText('');setReplyOpen(false);
      const {data:profile}=await supabase.from('users').select('username,avatar_url').eq('id',userId).maybeSingle();
      if(profile)setReplyPeople(current=>({...current,[userId]:profile as Person}));
    }catch(e:any){setError(e?.message||'Could not send reply.');}
    finally{setSending(false);}
  }

  if(loading)return <View style={[styles.screen,{backgroundColor}]}><ActivityIndicator color={accentColor} style={{marginTop:80}}/></View>;
  if(!review)return <View style={[styles.screen,{backgroundColor}]}><View style={styles.header}><TouchableOpacity onPress={()=>router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.headerTitle}>REVIEW</Text><View style={{width:30}}/></View><Text style={styles.error}>{error||'Review not found.'}</Text></View>;

  return <View style={[styles.screen,{backgroundColor}]}>
    <View style={styles.header}>
      <TouchableOpacity onPress={()=>router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity>
      <Text style={styles.headerTitle}>REVIEW</Text>
      <View style={{width:30}}/>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.songRow}>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle}>{review.item_name}</Text>
          <Text style={styles.artist}>{review.artist_name}</Text>
          <Text style={styles.stars}>{'★'.repeat(Math.floor(Number(review.rating)||0))}{Number(review.rating)%1?'½':''}</Text>
        </View>
        <TouchableOpacity onPress={()=>router.push({pathname:review.item_type==='album'?'/album/[id]':'/track/[id]',params:{id:review.item_id}} as any)}>
          {review.cover_url?<Image source={{uri:review.cover_url}} style={styles.cover}/>:<View style={styles.cover}/>}
        </TouchableOpacity>
      </View>
      <View style={styles.authorRow}>
        <Text style={styles.username}>{author?.username||'listener'}</Text>
        {author?.avatar_url?<Image source={{uri:author.avatar_url}} style={styles.avatar}/>:<View style={styles.avatar}/>}
      </View>
      {!!review.review_text&&<Text style={styles.reviewText}>{review.review_text}</Text>}
      {!!error&&<Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={()=>void toggleLike()} disabled={!userId}>
          <Text style={[styles.heart,{color:liked?accentColor:'#aaa'}]}>{liked?'♥':'♡'}</Text>
          <Text style={styles.actionText}>{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setReplyOpen(value=>!value)}><Text style={[styles.actionText,{color:accentColor,fontWeight:'600'}]}>Reply</Text></TouchableOpacity>
      </View>
      {replies.map(reply=>{
        const person=replyPeople[reply.user_id];
        return <View key={reply.id} style={styles.replyRow}>
          {person?.avatar_url?<Image source={{uri:person.avatar_url}} style={styles.replyAvatar}/>:<View style={styles.replyAvatar}/>}
          <View style={{flex:1}}>
            <Text style={styles.replyUsername}>{person?.username||'listener'}</Text>
            <Text style={styles.replyText}>{reply.reply_text}</Text>
          </View>
        </View>;
      })}
      {replyOpen&&<View style={styles.composer}>
        <TextInput value={replyText} onChangeText={setReplyText} placeholder="Write a reply..." placeholderTextColor="#777" multiline maxLength={2000} style={styles.input}/>
        <TouchableOpacity disabled={!replyText.trim()||sending||!userId} onPress={()=>void sendReply()} style={[styles.send,{backgroundColor:accentColor,opacity:!replyText.trim()||sending||!userId?0.5:1}]}>
          <Text style={styles.sendText}>{sending?'Sending...':'Send'}</Text>
        </TouchableOpacity>
      </View>}
    </ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  screen:{flex:1},header:{height:104,paddingTop:58,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#252525'},
  back:{color:'#fff',fontSize:32,width:30},headerTitle:{color:'#fff',fontSize:16,fontWeight:'700',letterSpacing:1.5},
  content:{padding:18,paddingBottom:50},songRow:{flexDirection:'row',alignItems:'stretch',gap:18,minHeight:132},
  songInfo:{flex:1,justifyContent:'center'},songTitle:{color:'#fff',fontSize:21,fontWeight:'600',lineHeight:27},artist:{color:'#aaa',fontSize:14,marginTop:6},
  stars:{color:'#00e054',fontSize:20,marginTop:12},cover:{width:132,height:132,borderRadius:5,backgroundColor:'#292929'},
  authorRow:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',alignSelf:'stretch',gap:8,marginTop:22,marginBottom:16},avatar:{width:30,height:30,borderRadius:15,backgroundColor:'#333'},
  username:{color:'#ddd',fontSize:13,fontWeight:'500'},reviewText:{color:'#eee',fontSize:16,lineHeight:25,marginBottom:20},
  actions:{flexDirection:'row',alignItems:'center',gap:24,borderTopWidth:1,borderTopColor:'#252525',paddingTop:14,marginTop:8,marginBottom:8},
  action:{flexDirection:'row',alignItems:'center',gap:7},heart:{fontSize:22},actionText:{color:'#aaa',fontSize:13},
  replyRow:{flexDirection:'row',alignItems:'flex-start',gap:9,paddingVertical:12,borderTopWidth:1,borderTopColor:'#202020'},
  replyAvatar:{width:28,height:28,borderRadius:14,backgroundColor:'#333'},replyUsername:{color:'#bbb',fontSize:12,fontWeight:'600'},
  replyText:{color:'#ddd',fontSize:14,lineHeight:20,marginTop:3},composer:{marginTop:16,gap:9},input:{minHeight:46,maxHeight:120,borderWidth:1,borderColor:'#383838',borderRadius:7,padding:11,color:'#fff',fontSize:14},
  send:{alignSelf:'flex-end',paddingHorizontal:17,paddingVertical:9,borderRadius:6},sendText:{color:'#fff',fontSize:12,fontWeight:'700'},error:{color:'#ff7777',padding:18}
});