import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#111113" },
          headerTintColor: "#f4f4f5",
          contentStyle: { backgroundColor: "#09090b" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="exam/[id]"
          options={{
            title: "BoardTestify · Examination",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="result/[id]" options={{ title: "Your result" }} />
      </Stack>
    </>
  );
}
