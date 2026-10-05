import { SiteFrame } from "@/components/SiteFrame";
import { CityPicker } from "@/components/CityPicker";

export default function Home() {
  return (
    <SiteFrame wide>
      <h1 className="text-[2rem] font-bold md:text-[2.6rem]">Feel it before you ride it.</h1>
      <p className="mt-4 max-w-2xl text-[1.1rem] leading-[1.7]">
        Pick a city, then a trip. BikeSim shows how stressful every block will be and lets you ride it virtually,
        through real street photos or a 3D model of the city, before you get on a bike.
      </p>
      <CityPicker />
    </SiteFrame>
  );
}
