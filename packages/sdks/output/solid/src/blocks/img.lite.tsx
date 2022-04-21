import { isEditing } from "../functions/is-editing";

export default function ImgComponent(props) {
  return (
    <img
      {...props.attributes}
      style={{
        objectFit: props.backgroundSize || "cover",
        objectPosition: props.backgroundPosition || "center",
      }}
      key={(isEditing() && props.imgSrc) || "default-key"}
      alt={props.altText}
      src={props.imgSrc}
    />
  );
}
