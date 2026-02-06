

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace WindowStyleHelper {

    export const applyStyle = (inputStyle:Record<string, unknown>, windowLeftPx:number, windowTopPx:number,  zIndex: number, opacity: number):Record<string, unknown> => {

      const style= {
        ...inputStyle,
        left: `${windowLeftPx}px`,
        top: `${windowTopPx}px`,
        transform: 'translate(0px, 0px)',
        'z-index': zIndex,
        opacity
      };

      return style;
    }

}