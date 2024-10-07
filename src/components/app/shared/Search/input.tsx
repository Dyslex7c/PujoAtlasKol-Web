import { useLocation, useAllPandals, useMutation } from '@/hooks';
import { cn } from '@/libs/utils';
import { useEffect, useMemo, useState } from 'react';
import { MdClear } from 'react-icons/md';

import { searchStore, allPandalStore, activePandalStore } from '@/stores';
import { useStore } from '@nanostores/react';
import Fuse from 'fuse.js';
import type { Pandal } from '@/types';
import { Api } from '@/constants';
import axios from 'axios';

const getKiloMetres = (src: google.maps.LatLngLiteral, dest: google.maps.LatLngLiteral) => {
  const R = 6371; // Radius of the Earth in kilometers
  const lat1 = src.lat * (Math.PI / 180); // Convert degrees to radians
  const lon1 = src.lng * (Math.PI / 180);
  const lat2 = dest.lat * (Math.PI / 180);
  const lon2 = dest.lng * (Math.PI / 180);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers

  return parseFloat(distance.toFixed(2));
};

type ProximityIndicatorProps = {
  location: GeolocationCoordinates | null;
  pandal: Pandal;
};

const ProximityIndicator = ({ location, pandal }: ProximityIndicatorProps) => {
  if (!location) {
    return null;
  }

  const distance = getKiloMetres(
    { lat: location.latitude, lng: location.longitude },
    { lat: pandal.lat, lng: pandal.lon },
  );

  return (
    <span
      className={cn('px-1 whitespace-nowrap rounded-3xl text-xs font-work outline outline-1', {
        'outline-lime-500 !text-lime-500': distance < 1,
        'outline-green-500 !text-green-500': distance >= 1 && distance < 5,
        'outline-orange-600 !text-orange-600': distance >= 5 && distance < 10,
        'outline-red-600 !text-red-600': distance >= 10,
        'outline-red-800 !text-red-500': distance >= 20,
        'flex flex-row items-center gap-1 w-fit': true,
      })}
    >
      <div
        className={cn('h-2 w-2 aspect-square rounded-full', {
          'bg-lime-500': distance < 1,
          'bg-green-500': distance >= 1 && distance < 5,
          'bg-orange-600': distance >= 5 && distance < 10,
          'bg-red-600': distance >= 10,
          'bg-red-800': distance >= 20,
        })}
      />
      {distance} km
    </span>
  );
};

export const SearchSuggestions = () => {
  const { location } = useLocation();
  const search = useStore(searchStore);
  const pandals = useStore(allPandalStore);
  const fuse = useMemo(
    () =>
      new Fuse(pandals, {
        keys: ['name', 'address'],
        threshold: 0.1,
        includeScore: true,
      }),
    [pandals],
  );

  const [sortedPandals, setSortedPandals] = useState<Pandal[]>([]);

  useEffect(() => {
    if (search.length === 0) {
      setSortedPandals([]);
      return;
    }

    const results = fuse.search(search).map((result) => result.item);
    setSortedPandals(results);
  }, [search, fuse]);

  const { mutate: updateSelectRanking } = useMutation({
    mutationFn: async (id: string) => {
      return axios.post(Api.Pujo.Searched, { ids: [id], term: 'select' });
    },
  });

  const { mutate: updateSearchRanking } = useMutation({
    mutationFn: async (ids: string[]) => {
      return axios.post(Api.Pujo.Searched, { ids, term: 'search' });
    },
  });

  const handleSearchSuggestionClick = (pandal: Pandal) => {
    updateSelectRanking(pandal.id);
    const selectedPandal = pandal;

    // get the IDs of the remaining pandals (not selected)
    const remainingPandalsIds = sortedPandals
      .filter((pandal) => pandal.id !== selectedPandal.id)
      .map((pandal) => pandal.id);

    // update ranking for the rest of the searched pandals
    if (remainingPandalsIds.length > 0) {
      updateSearchRanking(remainingPandalsIds);
    }

    setSortedPandals([]);
    activePandalStore.set(pandal);
    sessionStorage.clear();
    sessionStorage.setItem(
      'showOnMap',
      JSON.stringify({
        id: pandal.id,
        lat: pandal.lat,
        lon: pandal.lon,
      }),
    );

    // redirect to /app/pandals if not already there
    if (window.location.pathname !== '/app/pandals') window.location.href = '/app/pandals';
  };

  const classNames =
    navigator.userAgent.toLowerCase().indexOf('firefox') > -1
      ? cn(
          'absolute z-[100] hidden data-[active=true]:flex flex-col',
          'w-full px-3 h-fit max-h-80 overflow-hidden overflow-y-auto',
          'overflow-hidden overflow-y-scroll rounded-3xl',
          '[&::-webkit-scrollbar-thumb]:!hidden',
          '[&::-webkit-scrollbar-track]:!hidden',
          'bg-primary-background outline-primary-foreground',
        )
      : cn(
          'absolute z-[100] hidden data-[active=true]:flex flex-col',
          'w-full px-3 h-fit max-h-[calc(73dvh-20.5rem)] overflow-hidden overflow-y-auto',
          'overflow-hidden overflow-y-scroll rounded-3xl',
          '[&::-webkit-scrollbar-thumb]:!hidden',
          '[&::-webkit-scrollbar-track]:!hidden',
          'bg-primary-background outline-primary-foreground',
        );

  return (
    <ul data-active={sortedPandals.length > 0} className={classNames}>
      {sortedPandals.map((pandal) => (
        <li
          role="button"
          key={pandal.id}
          className={cn(
            'border-b-[1px] border-solid border-primary-foreground/20',
            'flex flex-row items-center justify-between py-2 w-full hover:bg-secondary-background',
          )}
          onClick={() => {
            handleSearchSuggestionClick(pandal);
          }}
        >
          <div className="flex flex-col gap-1 w-full">
            <h3 className="font-medium text-sm font-work leading-snug">{pandal.name}</h3>
            <ProximityIndicator location={location} pandal={pandal} />
            <p className="text-primary-foreground/50 font-normal text-xs font-work leading-snug">
              {pandal.address}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

export const SearchInput = () => {
  const search = useStore(searchStore);
  useAllPandals();

  return (
    <>
      <input
        type="text"
        role="searchbox"
        value={search}
        onChange={(e) => searchStore.set(e.target.value)}
        placeholder="Search for pandals"
        className={cn(
          'w-full h-12 placeholder-primary-foreground/50',
          'bg-primary-background font-work focus:outline-none',
          'text-primary-foreground font-medium text-sm font-work',
        )}
      />
      {search.length > 0 && (
        <MdClear size="25" onClick={() => searchStore.set('')} className="cursor-pointer" />
      )}
    </>
  );
};
