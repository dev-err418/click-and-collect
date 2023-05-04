import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform, useWindowDimensions, Switch, ActivityIndicator, Image } from "react-native";
import * as Device from "expo-device";
import { collection, getDocs, getFirestore, onSnapshot, query } from "firebase/firestore";
import * as Notifications from "expo-notifications"
import { StatusBar } from "expo-status-bar";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Constants from "expo-constants";

const Stack = createNativeStackNavigator();

const Home = () => {  

  const [cmds, setCmds] = useState([]);

  const url = "https://ttibczvpajlclubshgvf.supabase.co";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0aWJjenZwYWpsY2x1YnNoZ3ZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4MzAyODQyMCwiZXhwIjoxOTk4NjA0NDIwfQ.BWYxmrE4pJsM38Sog8WGSVjusKmmCmvwpyZ3DmptcyM";
  const supabase = createClient(url, key);

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
      token = (await Notifications.getExpoPushTokenAsync()).data;
      Notifications.addNotificationReceivedListener(async () => {
        await fetchAgain()
      })
      console.log(token);
    } else {
      alert('Must use physical device for Push Notifications');
    }

    return token;
  }

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, [])

  const fetchAgain = async () => {

    const { data, error } = await supabase.from("commandes").select().neq("paid", "TRUE");

    console.log(error)

    if (!error) {
      data.sort((a, b) => {
        if (a.date < b.date) {
          return 1;
        } else if (a.date > b.date) {
          return -1;
        } else {
          return 0;
        }
      })
      setCmds(data);
    }


  }

  useEffect(() => {
    const start = async () => {
      await fetchAgain();

      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
          },
          async (payload) => {
            await fetchAgain()
          }
        )
        .subscribe()
    }

    start()
  }, [])

  const { height, width } = useWindowDimensions();
  const navigation = useNavigation();

  return (
    <View style={{ height: "100%", width: "100%" }}>
      <StatusBar style="dark" />
      <ScrollView style={{ width: "100%", paddingTop: 10, backgroundColor: "white" }} >
        {
          cmds.map((el, i) => {

            const date = new Date(el.date);
            const datevalues = [
              date.getFullYear(),
              date.getMonth() + 1,
              date.getDate(),
              date.getHours(),
              date.getMinutes(),
              date.getSeconds(),
            ];

            return (
              <TouchableOpacity key={i}
                onPress={() => navigation.navigate("Modal", { element: el, supabase: supabase, func: fetchAgain })}
                style={{
                  alignSelf: "center",
                  backgroundColor: "white",
                  width: width - 40,
                  // width: "50%",
                  // minHeight: 100,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 20,
                  shadowColor: "#000",
                  shadowOffset: {
                    width: 0,
                    height: 0,
                  },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  // borderWidth: 1,
                  // borderColor: "black",
                  flexDirection: "row",
                  justifyContent: "space-between"
                }}
              >
                <View>
                  <Text>{datevalues[2]}/{datevalues[1]}/{datevalues[0]} à {datevalues[3] <= 9 ? "0" + datevalues[3] : datevalues[3]}h{datevalues[4] <= 9 ? "0" + datevalues[4] : datevalues[4]}</Text>
                  <Text style={{ marginVertical: 10 }}>Nom: <Text style={{ fontWeight: "600" }}>{el.nom}</Text></Text>                  
                  <Text>Prix total : <Text style={{ fontWeight: "600" }}>{Number(el.prix).toFixed(2)}€</Text></Text>
                </View>
                <View>
                  <Text style={{ fontWeight: "600" }}>n° {el.id}</Text>                  
                  <Text>Prête : {el.finie ? <View style={{ height: 12, width: 12, borderRadius: 12, backgroundColor: "green" }} />: <View style={{ height: 12, width: 12, borderRadius: 12, backgroundColor: "red" }} />}</Text>
                  <Text>Payée : {el.paid ? <View style={{ height: 12, width: 12, borderRadius: 12, backgroundColor: "green" }} /> : <View style={{ height: 12, width: 12, borderRadius: 12, backgroundColor: "red" }} />}</Text>
                </View>
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>

    </View>
  )
}

const Modal = () => {

  const navigation = useNavigation();
  const route = useRoute();
  const el = route.params?.element;
  const supabase = route.params?.supabase;
  const func = route.params?.func;

  const [p, setP] = useState(0);
  const [ready, setReady] = useState(false);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    setPaid(el.paid);
    setReady(el.finie);

    var count = 0;
    for (let i = 0; i < el.plats.length; i++) {
      const plat = el.plats[i];
      count += plat.quantity;
    }

    setP(count);
  }, []);

  const { height } = useWindowDimensions();

  return (
    <View style={{ padding: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 30, fontWeight: "700" }}>Commande n°{el.id}</Text>
        <TouchableOpacity onPress={() => {
          navigation.goBack()
          func();
        }}>
          <Text style={{ fontSize: 18 }}>retour</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ marginTop: 20, height: height - 65 - 30 - 150 }}>
        <Text style={{ fontSize: 18 }}>Pour : <Text style={{ fontWeight: "600" }}>{el.nom}</Text></Text>
        <Text style={{ fontSize: 18 }}>Prix total : <Text style={{ fontWeight: "600" }}>{Number(el.prix).toFixed(2)}€</Text></Text>

        <Text style={{ fontSize: 22, marginTop: 35, marginBottom: 10, fontWeight: "600", textDecorationLine: "underline" }}>{p} plats à préparer :</Text>
        {
          el.plats.map((plat, i) => {
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
                <Text style={{ marginRight: 15, fontSize: 18, fontWeight: "600" }}>{plat.quantity} x</Text>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "600" }}>{plat.name}</Text>
                  <Text>{plat.description}</Text>
                </View>
              </View>
            )
          })
        }
      </ScrollView>
      <TouchableOpacity style={{ justifyContent: "center", alignItems: "center", flexDirection: "row", backgroundColor: !ready ? "transparent" : "black", height: 65, borderRadius: 10, borderWidth: 1, borderColor: "black" }} onPress={
        async () => {
          if (ready) {
            if (paid) {
              // set paid to false + remove from db
              setLoading(true);

              const { error } = await supabase.from("commandes").update({ paid: false }).eq("id", el.id);

              if (!error) {
                setPaid(false);
                setLoading(false);
              } else {
                console.log(error);
                alert("Error");
                setLoading(false);
              }
            } else {
              // set paid to true + add to db
              setLoading(true);
              const { error } = await supabase.from("commandes").update({ paid: true }).eq("id", el.id);

              if (!error) {
                alert("La commande a bien été enregistrée comme payée !")
                setPaid(true);
                setLoading(false);
                navigation.goBack();
                func();
              } else {
                console.log(error);
                alert("Error");
                setLoading(false);
              }
            }
          } else {
            // set ready to true + add to db
            setLoading(true);
            const { error } = await supabase.from("commandes").update({ finie: true }).eq("id", el.id);
            if (!error) {
              setReady(true);
              setLoading(false)
            } else {
              console.log(error);
              alert("Error");
              setLoading(false);
            }
          }
        }
      }
        disabled={loading}
      >
        <Text style={{ color: !ready ? "black" : "white", fontSize: 20, fontWeight: "600" }}>{ready ? paid ? "Commande déjà payée" : "Commande payée" : "Commande préparée"}</Text>
        {loading && <ActivityIndicator size={"small"} style={{ marginLeft: 15 }} />}
      </TouchableOpacity>
    </View>
  )
}

const Head = () => {
  return (
    <View style={{ flexDirection: "row", paddingTop: Constants.statusBarHeight, height: 80 + Constants.statusBarHeight, alignItems: "center", justifyContent: "center" }}>
      <Image source={require("./assets/logo.png")} style={{ height: 80, width: 80, marginLeft: 20 }} resizeMode="contain" />
      <Text style={{ fontSize: 32, padding: 10, fontWeight: "600" }}>Commandes</Text>
    </View>
  )
}
const App = () => {  

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Home} options={{ headerTitle: "", header: () => <Head /> }} />
        <Stack.Screen name="Modal" component={Modal} options={{ presentation: "modal", headerShown: false, gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default App;