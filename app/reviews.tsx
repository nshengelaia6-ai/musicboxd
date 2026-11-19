import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Review = { id:string; user_id:string; item_type:'album'|'track'; item_id:string; parent_album_id:string|null; item_name:string; artist_name:string; cover_url:string; rating:number; review_text:string; created_at:string; updated_at:string; };
type Person = { id:string; username:string|null; avatar_url:string|null };
const filters = ['Recent','Friends'] as const;

function Stars({rating}:{rating:number}) {
  return <Text style={styles.stars}>{'★'.repeat(Math.floor(rating))}{rating % 1 ? '½' : ''}<Text style={styles.rating}> {Number(rating).toFixed(1)}/5</Text></Text>;
}

export default function Reviews() {
  const router=useRouter();
  const params=useLocalSearchParams<{itemType?:string;itemId?:string;itemName?:string;artistName?:string;coverUrl?:string;parentAlbumId?:string}>();
  const {backgroundColor,accentColor}=useAppTheme();
  const itemType=params.itemType==='track'?'track':'album';
  const itemId=String(params.itemId||'');
  const [filter,setFilter]=useState<'Recent'|'Friends'>('Recent');
  const [reviews,setReviews]=useState<Review[]>([]);
  const [people,setPeople]=useState<Record<string,Person>>({});
  const [myId,setMyId]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true); setError('');
    try {
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError) throw authError;
      const uid=auth.user?.id||''; setMyId(uid);
      let request=supabase.from('music_reviews').select('id,user_id,item_type,item_id,parent_album_id,item_name,artist_name,cover_url,rating,review_text,created_at,updated_at').eq('item_type',itemType).order('updated_at',{ascending:false}).limit(100);
      if(itemId) request=request.eq('item_id',itemId);
      const {data,error:reviewError}=await request;
      if(reviewError) throw reviewError;
      let rows=(data||[]) as Review[];
      if(filter==='Friends'){
        if(!uid) rows=[];
        else {
          const {data:follows,error:followsError}=await supabase.from('friendships').select('friend_id').eq('user_id',uid);
          if(followsError) throw followsError;
          const followedIds=(follows||[]).map((row:any)=>row.friend_id);
          let mutualIds=new Set<string>();
          if(followedIds.length){
            const {data:reciprocal,error:reciprocalError}=await supabase.from('friendships').select('user_id').eq('friend_id',uid).in('user_id',followedIds);
            if(reciprocalError) throw reciprocalError;
            mutualIds=new Set((reciprocal||[]).map((row:any)=>row.user_id));
          }
          rows=rows.filter(row=>mutualIds.has(row.user_id)||row.user_id===uid);
        }
      }
      const userIds=[...new Set(rows.map(row=>row.user_id))];
      const {data:profiles,error:profilesError}=userIds.length?await supabase.from('users').select('id,username,avatar_url').in('id',userIds):{data:[],error:null};
      if(profilesError) throw profilesError;
      const map:Record<string,Person>={}; (profiles||[]).forEach((p:any)=>map[p.id]=p);
      setPeople(map); setReviews(rows);
    } catch(e:any) { setError(e?.message||'Could not load reviews.'); }
    finally { setLoading(false); }
  },[filter,itemId,itemType]);

  useFocusEffect(useCallback(()=>{void load();},[load]));

  function writeReview(){
    router.push({pathname:'/review/new',params:{albumId:itemId,albumName:params.itemName||'',albumArtist:params.artistName||'',albumCover:params.coverUrl||'',itemType,parentAlbumId:params.parentAlbumId||(itemType==='album'?itemId:'')}} as any);
  }

  return <View style={[styles.screen,{backgroundColor}]}>
    <View style={styles.header}>
      <TouchableOpacity onPress={()=>router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity>
      <Text style={styles.heading}>REVIEWS</Text>
      {itemId ? <TouchableOpacity onPress={writeReview}><Text style={[styles.write,{color:accentColor}]}>＋ Review</Text></TouchableOpacity> : <View style={{width:70}} />}
    </View>
    <View style={styles.itemHeader}>
      {params.coverUrl?<Image source={{uri:params.coverUrl}} style={styles.cover}/>:<View style={styles.cover}/>}
      <View style={{flex:1}}>
        <Text style={styles.itemTitle}>{params.itemName||'Music reviews'}</Text>
        <Text style={styles.artist}>{params.artistName||''}</Text>
        <Text style={styles.count}>{reviews.length} {reviews.length===1?'review':'reviews'}</Text>
      </View>
    </View>
    <View style={styles.filters}>{filters.map(value=><TouchableOpacity key={value} onPress={()=>setFilter(value)} style={[styles.filter,filter===value&&{borderBottomColor:accentColor}]}><Text style={[styles.filterText,filter===value&&{color:'#fff'}]}>{value}</Text></TouchableOpacity>)}</View>
    {loading?<ActivityIndicator color={accentColor} style={{marginTop:40}}/>:
      <ScrollView contentContainerStyle={styles.list}>
        {!!error&&<Text style={styles.error}>{error}</Text>}
        {!error&&reviews.length===0&&<Text style={styles.empty}>No reviews yet. Be the first to write one.</Text>}
        {reviews.map(review=>{
          const person=people[review.user_id]; const own=review.user_id===myId;
          return <View key={review.id} style={styles.card}>
            <View style={styles.personRow}>
              <TouchableOpacity onPress={()=>router.push({pathname:'/user/[id]',params:{id:review.user_id}} as any)}>
                {person?.avatar_url?<Image source={{uri:person.avatar_url}} style={styles.avatar}/>:<View style={styles.avatar}/>}
              </TouchableOpacity>
              <View style={{flex:1}}>
                <TouchableOpacity onPress={()=>router.push({pathname:'/user/[id]',params:{id:review.user_id}} as any)}><Text style={styles.username}>@{person?.username||'listener'}</Text></TouchableOpacity>
                <Text style={styles.date}>{new Date(review.updated_at || review.created_at).toLocaleDateString()}</Text>
              </View>
              {own&&<TouchableOpacity onPress={()=>router.push({pathname:'/review/new',params:{albumId:review.item_id,albumName:review.item_name,albumArtist:review.artist_name,albumCover:review.cover_url,currentRating:String(review.rating),itemType:review.item_type,parentAlbumId:review.parent_album_id||''}} as any)}><Text style={[styles.edit,{color:accentColor}]}>Edit</Text></TouchableOpacity>}
            </View>
            <Stars rating={Number(review.rating)||0}/>
            {!!review.review_text&&<Text style={styles.reviewText}>{review.review_text}</Text>}
          </View>;
        })}
      </ScrollView>}
  </View>;
}

const styles=StyleSheet.create({
 screen:{flex:1},header:{paddingTop:58,paddingHorizontal:18,paddingBottom:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#252525'},
 back:{color:'#fff',fontSize:32,width:36},heading:{color:'#fff',fontSize:16,fontWeight:'700',letterSpacing:1.5},write:{fontSize:14,fontWeight:'700'},
 itemHeader:{flexDirection:'row',alignItems:'center',gap:14,padding:18},cover:{width:66,height:66,borderRadius:6,backgroundColor:'#292929'},itemTitle:{color:'#fff',fontSize:17,fontWeight:'700'},artist:{color:'#aaa',marginTop:3},count:{color:'#777',fontSize:12,marginTop:6},
 filters:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#252525',paddingHorizontal:18},filter:{paddingVertical:12,marginRight:24,borderBottomWidth:2,borderBottomColor:'transparent'},filterText:{color:'#888',fontSize:13,fontWeight:'600'},
 list:{paddingHorizontal:18,paddingBottom:50},card:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:'#252525'},personRow:{flexDirection:'row',alignItems:'center',gap:10},avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#333'},username:{color:'#fff',fontWeight:'700',fontSize:14},date:{color:'#777',fontSize:11,marginTop:3},edit:{fontSize:13,fontWeight:'700'},stars:{color:'#00e054',fontSize:18,marginTop:12},rating:{color:'#888',fontSize:12},reviewText:{color:'#e5e5e5',fontSize:15,lineHeight:23,marginTop:12},empty:{color:'#888',textAlign:'center',marginTop:48,lineHeight:22},error:{color:'#ff7777',marginTop:20}
});