import { useEffect, useRef } from "react";
import { INPUT_REPEAT_MS } from "../game/player";

export const useControls = (onInput) => {
  const onInputRef = useRef(onInput);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    const keys = {};
    let movementIntervalId;

    const handleKeyDown = (e) => {
      keys[e.key] = true;

      if (e.key === " " && !e.repeat) {
        onInputRef.current("attack");
      }
    };

    const handleKeyUp = (e) => {
      keys[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    movementIntervalId = setInterval(() => {
      if (keys["ArrowRight"]) onInputRef.current("right");
      if (keys["ArrowLeft"]) onInputRef.current("left");
    }, INPUT_REPEAT_MS);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearInterval(movementIntervalId);
    };
  }, []);
};
