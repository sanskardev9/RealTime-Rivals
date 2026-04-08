import { useEffect, useRef } from "react";

export const useControls = (onInput) => {
  const onInputRef = useRef(onInput);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    const keys = {};
    let animationFrameId;

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

    const loop = () => {
      if (keys["ArrowRight"]) onInputRef.current("right");
      if (keys["ArrowLeft"]) onInputRef.current("left");

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
};
