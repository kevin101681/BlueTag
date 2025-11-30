
import { TouchEvent, useState } from 'react';

interface SwipeInput {
  onSwipedRight?: () => void;
  onSwipedLeft?: () => void;
  onSwipedUp?: () => void;
  onSwipedDown?: () => void;
}

interface SwipeOutput {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
}

export const useSwipe = ({ onSwipedRight, onSwipedLeft, onSwipedUp, onSwipedDown }: SwipeInput): SwipeOutput => {
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null);

  // Minimum distance (px) to be considered a swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null); // Reset touch end on new touch
    if (e.targetTouches && e.targetTouches.length > 0) {
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.targetTouches && e.targetTouches.length > 0) {
        setTouchEnd({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    
    const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);
    const isVertical = Math.abs(distanceY) > Math.abs(distanceX);

    if (isHorizontal) {
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;

        if (isLeftSwipe && onSwipedLeft) {
            onSwipedLeft();
        }
        if (isRightSwipe && onSwipedRight) {
            onSwipedRight();
        }
    }

    if (isVertical) {
        const isUpSwipe = distanceY > minSwipeDistance;
        const isDownSwipe = distanceY < -minSwipeDistance;

        if (isUpSwipe && onSwipedUp) {
            onSwipedUp();
        }
        if (isDownSwipe && onSwipedDown) {
            onSwipedDown();
        }
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
};
