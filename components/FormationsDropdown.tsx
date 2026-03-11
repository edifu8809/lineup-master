import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type FormationsDropdownProps = {
  value: string;
  options: string[];
  onSelect: (formation: string) => void;
};

function FormationsDropdown({ value, options, onSelect }: FormationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: open ? 1 : 0,
      duration: open ? 220 : 180,
      useNativeDriver: false,
    }).start();
  }, [expandAnim, open]);

  const animatedMenuStyle = useMemo(
    () => ({
      maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, options.length * 44 + 8] }),
      opacity: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
      transform: [
        {
          translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
        },
      ],
    }),
    [expandAnim, options.length]
  );

  return (
    <View style={styles.container}>
      <Pressable style={[styles.trigger, open && styles.triggerOpen]} onPress={() => setOpen((previous) => !previous)}>
        <Text style={styles.triggerText}>{value}</Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      <Animated.View style={[styles.menuWrap, animatedMenuStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <View style={styles.menu}>
          {options.map((option) => (
            <Pressable
              key={option}
              style={[styles.option, option === value && styles.optionActive]}
              onPress={() => {
                onSelect(option);
                setOpen(false);
              }}
            >
              <Text style={[styles.optionText, option === value && styles.optionTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(FormationsDropdown);

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  trigger: {
    width: '100%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4FD1ED',
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#4FD1ED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
  },
  triggerOpen: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  triggerText: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  chevron: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '900',
  },
  menu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#2A8FB8',
    borderRadius: 10,
    backgroundColor: '#0F1723',
    overflow: 'hidden',
  },
  menuWrap: {
    overflow: 'hidden',
  },
  option: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2A3B',
  },
  optionActive: {
    backgroundColor: '#102231',
  },
  optionText: {
    color: '#C9D1D9',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  optionTextActive: {
    color: '#4FD1ED',
  },
});
