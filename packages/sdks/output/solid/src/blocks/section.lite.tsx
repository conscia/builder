export default function SectionComponent(props) {
  return (
    <section
      {...props.attributes}
      style={
        props.maxWidth && typeof props.maxWidth === "number"
          ? {
              maxWidth: props.maxWidth,
            }
          : undefined
      }
    >
      {props.children}
    </section>
  );
}
