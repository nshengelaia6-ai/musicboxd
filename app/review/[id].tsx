import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Review = {
  id:string; user_id:string; item_type:string; item_id:string; item_name:string;
  artist_name:string; cover_url:string; rating:number; review_text:string;
};
type Reply = { id:string; review_id:string; user_id:string; reply_text:string; created_at:string };
type Person = { username:string|null; avatar_url:string|null };
type LikedReview = { id:string; user_id:string; item_name:string; artist_name:string; cover_url:string|null; item_type:string; item_id:string };
type LikedPerson = { id:string; username:string|null; avatar_url:string|null };

export default function ReviewDetail() {
  const { id } = useLocalSearchParams<{id:string}>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [review,setReview]=useState<Review|null>(null);
  const [author,setAuthor]=useState<Person|null>(null);
  const [replies,setReplies]=useState<Reply[]>([]);
  const [replyPeople,setReplyPeople]=useState<Record<string,Person>>({});
  const [myProfile,setMyProfile]=useState<Person|null>(null);
  const [replyText,setReplyText]=useState('');
  const [replyOpen,setReplyOpen]=useState(false);
  const [userId,setUserId]=useState('');
  const [likes,setLikes]=useState(0);
  const [liked,setLiked]=useState(false);
  const [sending,setSending]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [releaseYear,setReleaseYear]=useState('');
  const [albumId,setAlbumId]=useState('');
  const [listenedAt,setListenedAt]=useState('');
  const [authorLikedSong,setAuthorLikedSong]=useState(false);
  const [authorLikedReviews,setAuthorLikedReviews]=useState<LikedReview[]>([]);
  const [likedPeople,setLikedPeople]=useState<LikedPerson[]>([]);
  const likedPeopleScroll=useRef<ScrollView>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError('');setMyProfile(null);setLikedPeople([]);setReplyPeople({});setReplies([]);setReleaseYear('');setAlbumId('');setAuthorLikedSong(false);
    try {
      const [{data:auth,error:authError},{data:row,error:reviewError}]=await Promise.all([
        supabase.auth.getUser(),
        supabase.from('music_reviews').select('id,user_id,item_type,item_id,item_name,artist_name,cover_url,rating,review_text').eq('id',String(id)).maybeSingle()
      ]);
      if(authError) throw authError;
      if(reviewError) throw reviewError;
      if(!row) {setReview(null);return;}
      const uid=auth.user?.id||'';setUserId(uid);setReview(row as Review);
      if(uid){const {data:ownProfile}=await supabase.from('users').select('username,avatar_url').eq('id',uid).maybeSingle();setMyProfile(ownProfile as Person|null);}
      setReleaseYear('');
      setAlbumId(row.item_type==='album'?row.item_id:'');
      try {
        const {data:musicData,error:musicError}=await supabase.functions.invoke('spotify-search',{body:{action:row.item_type==='album'?'album':'track',id:row.item_id}});
        if(!musicError&&!musicData?.error){
          if(row.item_type==='track'&&musicData?.album?.id) setAlbumId(String(musicData.album.id));
          const date= row.item_type==='album' ? musicData?.release_date : musicData?.album?.release_date;
          if(date) setReleaseYear(String(date).slice(0,4));
        }
      } catch { /* Release year is optional; keep the review available if Spotify lookup fails. */ }
      const [{data:profile,error:profileError},{data:likeRows,error:likesError},{data:myLike,error:myLikeError},{data:replyRows,error:repliesError},{data:listenedRow,error:listenedError},{data:authorLikeRows,error:authorLikesError},{data:authorSongLike,error:authorSongLikeError}]=await Promise.all([
        supabase.from('users').select('username,avatar_url').eq('id',row.user_id).maybeSingle(),
        supabase.from('music_review_likes').select('user_id').eq('review_id',row.id),
        uid?supabase.from('music_review_likes').select('review_id').eq('review_id',row.id).eq('user_id',uid).maybeSingle():Promise.resolve({data:null,error:null} as any),
        supabase.from('music_review_replies').select('id,review_id,user_id,reply_text,created_at').eq('review_id',row.id).order('created_at',{ascending:true}),
        supabase.from('user_activity').select('created_at').eq('user_id',row.user_id).eq('activity_type','listened').eq('item_key',row.item_id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
        supabase.from('music_review_likes').select('review_id').eq('user_id',row.user_id),
        supabase.from('user_activity').select('id').eq('user_id',row.user_id).eq('activity_type','liked').eq('item_key',row.item_id).limit(1).maybeSingle()
      ]);
      if(profileError) throw profileError;if(likesError) throw likesError;if(myLikeError) throw myLikeError;if(repliesError) throw repliesError;if(listenedError) throw listenedError;if(authorLikesError) throw authorLikesError;if(authorSongLikeError) throw authorSongLikeError;
      setAuthor(profile as Person|null);setLikes((likeRows||[]).length);setLiked(!!myLike);setAuthorLikedSong(!!authorSongLike);
      setListenedAt(listenedRow?.created_at || '');
      const likedReviewIds=[...new Set((authorLikeRows||[]).map((item:any)=>item.review_id).filter((likedId:string)=>likedId!==row.id))];
      if(likedReviewIds.length){
        const {data:likedReviews,error:likedReviewsError}=await supabase.from('music_reviews').select('id,user_id').in('id',likedReviewIds);
        if(likedReviewsError) throw likedReviewsError;
        const likedUserIds=[...new Set((likedReviews||[]).map((item:any)=>item.user_id).filter(Boolean))];
        if(likedUserIds.length){
          const {data:likedProfiles,error:likedProfilesError}=await supabase.from('users').select('id,username,avatar_url').in('id',likedUserIds);
          if(likedProfilesError) throw likedProfilesError;
          const peopleById=new Map((likedProfiles||[]).map((person:any)=>[person.id,person]));
          setLikedPeople(likedUserIds.map(personId=>peopleById.get(personId)).filter(Boolean) as LikedPerson[]);
        } else setLikedPeople([]);
      } else setLikedPeople([]);
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
    <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={0}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.titleBlock}>
        <View style={styles.reviewSide}>
          <View style={styles.authorRow}>
            {author?.avatar_url ? <Image source={{uri:author.avatar_url}} style={styles.authorAvatar}/> : <View style={styles.authorAvatar}/>}
            <Text style={styles.authorName} numberOfLines={1}>{author?.username || 'listener'}</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.songTitle} numberOfLines={3}>{review.item_name}</Text>
            {!!releaseYear&&<Text style={styles.releaseYear}>{releaseYear}</Text>}
          </View>
          <View style={styles.ratingAndLike}>
            {Number(review.rating) > 0 ? (
              <Text style={styles.rating}>{'★'.repeat(Math.floor(Number(review.rating)))}{Number(review.rating) % 1 ? '½' : ''}</Text>
            ) : null}
            {authorLikedSong&&<View style={styles.inlineLike}><Text style={[styles.heart,{color:'#aaa'}]}>♥</Text></View>}
          </View>
          {!!listenedAt&&<Text style={styles.listenedDate}>Listened {new Date(listenedAt).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'})}</Text>}
          {!!review.review_text&&<Text style={styles.reviewText}>{review.review_text}</Text>}
          <TouchableOpacity style={styles.reviewLikeRow} onPress={()=>void toggleLike()} disabled={!userId}>
            <Text style={[styles.reviewLikeHeart,{color:liked?accentColor:'#aaa'}]}>{liked?'♥':'♡'}</Text>
            <Text style={styles.reviewLikeLabel}>Like review</Text>
            {likes>0&&<Text style={styles.likeCount}>{likes}</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={()=>router.push({pathname:review.item_type==='album'?'/album/[id]':'/track/[id]',params:{id:review.item_id}} as any)}>
          {review.cover_url?<Image source={{uri:review.cover_url}} style={styles.cover}/>:<View style={styles.cover}/>}
        </TouchableOpacity>
      </View>
      {!!error&&<Text style={styles.error}>{error}</Text>}
      {likedPeople.length > 0 ? <>
        <View style={styles.actions}>
          <Text style={styles.likedByHeading}>Liked by {author?.username || 'listener'}</Text>
          <TouchableOpacity style={styles.likedPeopleMore} onPress={()=>likedPeopleScroll.current?.scrollTo({x:9999,y:0,animated:true})}>
            <Text style={styles.likedPeopleMoreText}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.likedPeopleRow}>
          <ScrollView ref={likedPeopleScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.likedPeopleContent}>
            {likedPeople.map((person,index)=><TouchableOpacity key={person.id} activeOpacity={0.8} style={[styles.likedPersonButton,index>0&&styles.likedPersonOverlap]} onPress={()=>router.push({pathname:'/user/[id]',params:{id:person.id}} as any)}>
              {person.avatar_url?<Image source={{uri:person.avatar_url}} style={styles.likedPersonAvatar}/>:<View style={styles.likedPersonAvatar}/>}
            </TouchableOpacity>)}
          </ScrollView>
        </View>
      </> : <View style={styles.emptyLikedPeopleDivider} />}
      <View style={styles.reviewLinksRow}>
        <TouchableOpacity style={styles.replyButton} onPress={()=>setReplyOpen(value=>!value)}>
          <Text style={styles.replyButtonText}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!(albumId||(review.item_type==='album'?review.item_id:''))} style={[styles.albumButton,!(albumId||(review.item_type==='album'?review.item_id:''))&&styles.albumButtonDisabled]} onPress={()=>{const targetAlbumId=albumId||(review.item_type==='album'?review.item_id:'');if(targetAlbumId)router.push({pathname:'/album/[id]',params:{id:targetAlbumId}} as any);}}>
          <Text style={styles.albumButtonText}>Album</Text>
          <Text style={styles.albumButtonIcon}>{">"}</Text>
        </TouchableOpacity>
      </View>
      {replyOpen&&<View style={styles.composer}>
        {myProfile?.avatar_url?<Image source={{uri:myProfile.avatar_url}} style={styles.composerAvatar}/>:<View style={styles.composerAvatar}/>}
        <View style={styles.composerBody}>
          <TextInput value={replyText} onChangeText={setReplyText} placeholder={`Reply to ${author?.username||'listener'}...`} placeholderTextColor="#777" multiline maxLength={2000} autoFocus editable={!!userId} style={styles.input}/>
          <View style={styles.composerFooter}>
            <Text style={styles.replyAs}>{userId?(myProfile?.username||'Your reply'):'Sign in to reply'}</Text>
            <TouchableOpacity disabled={!replyText.trim()||sending||!userId} onPress={()=>void sendReply()} style={[styles.send,{backgroundColor:accentColor,opacity:!replyText.trim()||sending||!userId?0.5:1}]}>
              <Text style={styles.sendText}>{sending?'Posting...':'Post'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>}
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
    </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const styles=StyleSheet.create({
  screen:{flex:1},keyboardArea:{flex:1},header:{height:104,paddingTop:58,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#252525'},
  back:{color:'#fff',fontSize:32,width:30},headerTitle:{color:'#fff',fontSize:16,fontWeight:'700',letterSpacing:1.5},
  content:{padding:18,paddingBottom:50},
  reviewSide:{flex:1,minWidth:0},titleBlock:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:14},titleHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  songHeading:{flex:1,minWidth:0},titleRow:{flexDirection:'row',alignItems:'baseline',flexWrap:'wrap',columnGap:8,rowGap:3},
  rating:{color:'#9BA7B2',fontSize:15,letterSpacing:1},reviewLikeRow:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',marginTop:12,paddingVertical:3},reviewLikeHeart:{fontSize:20},reviewLikeLabel:{color:'#aaa',fontSize:12},ratingAndLike:{flexDirection:'row',alignItems:'center',gap:12,marginTop:8,marginBottom:2},inlineLike:{flexDirection:'row',alignItems:'center',gap:5},likeCount:{color:'#999',fontSize:12},listenedDate:{color:'#777',fontSize:11,marginBottom:10},authorRow:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:10},
  authorAvatar:{width:30,height:30,borderRadius:15,backgroundColor:'#333'},authorName:{color:'#aaa',fontSize:12,flexShrink:1},
  songTitle:{color:'#fff',fontSize:18,fontWeight:'600',lineHeight:24,flexShrink:1},releaseYear:{color:'#999',fontSize:13},
  cover:{width:116,height:116,borderRadius:5,backgroundColor:'#292929'},reviewText:{color:'#eee',fontSize:14,lineHeight:21,marginTop:2},
  actions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,borderTopWidth:1,borderTopColor:'#252525',paddingTop:14,marginTop:8,marginBottom:8},likedByHeading:{color:'#aaa',fontSize:13,fontWeight:'600'},likedPeopleRow:{flexDirection:'row',alignItems:'center',marginTop:2,borderBottomWidth:1,borderBottomColor:'#252525',paddingBottom:8,marginBottom:8},emptyLikedPeopleDivider:{height:1,backgroundColor:'#252525',marginTop:14,marginBottom:8},likedPeopleContent:{flexDirection:'row',alignItems:'center',paddingVertical:6,paddingRight:6},likedPersonButton:{width:32,height:32,borderRadius:16,borderWidth:1.5,borderColor:'#000',overflow:'hidden'},likedPersonOverlap:{marginLeft:-7},likedPersonAvatar:{width:32,height:32,borderRadius:16,backgroundColor:'#333'},likedPeopleMore:{width:28,height:28,alignItems:'center',justifyContent:'center',marginLeft:8},likedPeopleMoreText:{color:'#aaa',fontSize:25,lineHeight:27},
  reviewLinksRow:{flexDirection:'row',alignItems:'center',justifyContent:'flex-start',gap:10,paddingTop:10,paddingBottom:4},replyButton:{backgroundColor:'#d0d0d0',paddingHorizontal:10,paddingVertical:5,borderRadius:5},replyButtonText:{color:'#222',fontSize:12,fontWeight:'600'},albumButton:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#454545',paddingHorizontal:10,paddingVertical:5,borderRadius:5},albumButtonDisabled:{opacity:0.45},albumButtonText:{color:'#f2f2f2',fontSize:12,fontWeight:'600'},albumButtonIcon:{color:'#f2f2f2',fontSize:13,fontWeight:'600'},action:{flexDirection:'row',alignItems:'center',gap:7},heart:{fontSize:22},actionText:{color:'#aaa',fontSize:13},
  replyRow:{flexDirection:'row',alignItems:'flex-start',gap:9,paddingVertical:12,borderTopWidth:1,borderTopColor:'#202020'},
  replyAvatar:{width:28,height:28,borderRadius:14,backgroundColor:'#333'},replyUsername:{color:'#bbb',fontSize:12,fontWeight:'600'},
  replyText:{color:'#ddd',fontSize:14,lineHeight:20,marginTop:3},composer:{flexDirection:'row',alignItems:'flex-start',gap:10,marginTop:14,paddingTop:13,borderTopWidth:1,borderTopColor:'#252525'},composerAvatar:{width:32,height:32,borderRadius:16,backgroundColor:'#333'},composerBody:{flex:1,minWidth:0},input:{minHeight:58,maxHeight:140,borderWidth:1,borderColor:'#383838',borderRadius:6,padding:10,color:'#fff',fontSize:14,textAlignVertical:'top'},composerFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8},replyAs:{color:'#777',fontSize:11},
  send:{alignSelf:'flex-end',paddingHorizontal:17,paddingVertical:9,borderRadius:6},sendText:{color:'#fff',fontSize:12,fontWeight:'700'},error:{color:'#ff7777',padding:18}
});