import { useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

type StarRatingProps = {
  rating: number;
  onChange: (rating: number) => void;
  starSize?: number;
  starGap?: number;
  starCount?: number;
};

export default function StarRating({
  rating,
  onChange,
  starSize = 40,
  starGap = 8,
  starCount = 5,
}: StarRatingProps) {
  const starWidth = starSize + starGap;

  function ratingFromX(x: number) {
    const raw = x / starWidth + 1;
    const clamped = Math.max(0, Math.min(starCount, raw));

    return Math.round(clamped * 2) / 2;
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onChange(ratingFromX(evt.nativeEvent.locationX));
      },
      onPanResponderMove: (evt) => {
        onChange(ratingFromX(evt.nativeEvent.locationX));
      },
    })
  ).current;

  return (
    <View
      style={styles.row}
      {...panResponder.panHandlers}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      {Array.from({ length: starCount }, (_, i) => {
        const s = i + 1;
        const filled = rating >= s;
        const half = !filled && rating >= s - 0.5;
        return (
          <View
            key={s}
            style={{ width: starSize, height: starSize, marginRight: s === starCount ? 0 : starGap }}
          >
            <Text style={[styles.star, { fontSize: starSize * 0.9 }]}>★</Text>
            {(filled || half) && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { overflow: 'hidden', width: filled ? starSize : starSize / 2 },
                ]}
              >
                <Text style={[styles.starActive, { fontSize: starSize * 0.9 }]}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { color: '#333', textAlign: 'center' },
  starActive: { color: '#ffb6c1', textAlign: 'center' },
});
