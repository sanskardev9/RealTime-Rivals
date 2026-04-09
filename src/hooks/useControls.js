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

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        console.log("Movement key down:", e.key);
      }

      if (e.key === " " && !e.repeat) {
        console.log("Attack key down: Space");
        onInputRef.current("attack");
      }
    };

    const handleKeyUp = (e) => {
      keys[e.key] = false;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        console.log("Movement key up:", e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    movementIntervalId = setInterval(() => {
      if (keys["ArrowRight"]) {
        console.log("Sending local input: right");
        onInputRef.current("right");
      }
      if (keys["ArrowLeft"]) {
        console.log("Sending local input: left");
        onInputRef.current("left");
      }
    }, INPUT_REPEAT_MS);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearInterval(movementIntervalId);
    };
  }, []);
};
